import { randomBytes } from 'node:crypto';
import { sql } from 'drizzle-orm';
import request from 'supertest';
import type { Express } from 'express';
import { aiStreamEventSchema, type AiStreamEvent } from '@acme/shared';
import { createApp } from '../app.js';
import type { Config } from '../config.js';
import { buildContainer, type AppContainer } from '../container.js';
import { createDb, type Db } from '../db/database.js';
import { seedDatabase } from '../db/seed/seed.js';
import type { LlmClient } from '../modules/ai/llm.js';
import type { EvalCase, EvalUser } from './cases.js';
import { EVAL_SEED, SeedFacts } from './facts.js';
import type { CaseOutcome, GradeContext, GradedRun, Integrity } from './grader.js';
import { enableTestAiReader, resetAndMigrate } from './test-db.js';

const ORIGIN = 'http://localhost:5173';
const DEMO_EMAILS: Record<EvalUser, string> = {
  global: 'global.hr@demo.acme.test',
  india: 'india.hr@demo.acme.test',
  ukus: 'uk-us.hr@demo.acme.test',
};

type Agent = ReturnType<typeof request.agent>;

export interface HarnessOptions {
  /** A superuser (or owner) URL for a throwaway database: it is reset, migrated and seeded. */
  databaseUrl: string;
  /** The model to evaluate: a scripted fake in CI, null to build the real client from the key. */
  llm: LlmClient | null;
  anthropicApiKey?: string;
  ai?: Config['ai'];
}

/**
 * Runs eval cases through the real HTTP API, agent loop, SQL guard and reader role, against a
 * database seeded with EVAL_SEED. Used by both the CI suite (scripted fake) and `npm run evals`.
 */
export class EvalHarness {
  private agents = new Map<EvalUser, Agent>();
  private logLines: string[] = [];

  private constructor(
    private owner: Db,
    private container: AppContainer,
    private app: Express,
    readonly facts: SeedFacts,
    private scopes: Record<EvalUser, string[]>,
    private restoreReader: () => Promise<void>,
  ) {}

  static async start(options: HarnessOptions): Promise<EvalHarness> {
    const owner = createDb(options.databaseUrl, { max: 2 });
    await resetAndMigrate(owner);
    // A throwaway password for the demo users, never shown or stored.
    const password = randomBytes(18).toString('base64url');
    await seedDatabase(owner, {
      ...EVAL_SEED,
      reset: true,
      demoUsers: true,
      demoPassword: password,
      log: () => {},
    });
    const reader = await enableTestAiReader(owner, options.databaseUrl);

    const { rows: titleRows } = await owner.execute<{ id: string; name: string }>(
      sql`select id, name from job_titles`,
    );
    const { rows: countryRows } = await owner.execute<{ code: string }>(
      sql`select code from countries order by code`,
    );
    const facts = new SeedFacts(Object.fromEntries(titleRows.map((r) => [r.id, r.name])));

    const config: Config = {
      databaseUrl: options.databaseUrl,
      allowedOrigins: [ORIGIN],
      appUrl: ORIGIN,
      secureCookies: false,
      dbPoolSize: 4,
      authRateLimit: 1000,
      databaseUrlAi: reader.url,
      anthropicApiKey: options.anthropicApiKey,
      ai: { messagesPerMinute: 1000, messagesPerDay: 10_000, ...options.ai },
    };
    const lines: string[] = [];
    const log = (level: string) => (message: string, meta?: Record<string, unknown>) =>
      lines.push(JSON.stringify({ level, message, ...meta }));
    let container = buildContainer(config).override('logger', () => ({
      error: log('error'),
      info: log('info'),
      warn: log('warn'),
    }));
    if (options.llm) {
      const llm = options.llm;
      container = container.override('llmClient', () => llm);
    }
    const app = createApp({ container });
    const harness = new EvalHarness(
      owner,
      container,
      app,
      facts,
      { global: countryRows.map((r) => r.code), india: ['IN'], ukus: ['GB', 'US'] },
      reader.restore,
    );
    harness.logLines = lines;
    for (const user of Object.keys(DEMO_EMAILS) as EvalUser[]) {
      const agent = request.agent(app);
      const res = await agent
        .post('/api/auth/sign-in')
        .set('Origin', ORIGIN)
        .send({ email: DEMO_EMAILS[user], password });
      if (res.status !== 200)
        throw new Error(`Sign-in for the ${user} demo user failed: ${res.status}`);
      harness.agents.set(user, agent);
    }
    return harness;
  }

  context(c: EvalCase): GradeContext {
    return { secrets: this.facts.secrets, scope: this.scopes[c.user] };
  }

  private async integrity(): Promise<Integrity> {
    const { rows } = await this.owner.execute<{ exists: boolean }>(
      sql`select to_regclass('public.employees') is not null as exists`,
    );
    if (!rows[0]?.exists) return { tableExists: false, employees: 0, salaryTotal: '0' };
    const { rows: totals } = await this.owner.execute<{ n: string; total: string }>(
      sql`select count(*)::text as n, coalesce(sum(salary_amount_minor), 0)::text as total from employees`,
    );
    return { tableExists: true, employees: Number(totals[0]!.n), salaryTotal: totals[0]!.total };
  }

  /** Asks one case's question in a new conversation and collects what happened. */
  async run(c: EvalCase): Promise<CaseOutcome> {
    const started = Date.now();
    const integrityBefore = c.expect.integrity ? await this.integrity() : undefined;
    const firstLog = this.logLines.length;
    const res = await this.agents
      .get(c.user)!
      .post('/api/ai/messages')
      .set('Origin', ORIGIN)
      .send({ message: c.question })
      .buffer(true)
      .parse((response, done) => {
        let text = '';
        response.setEncoding('utf8');
        response.on('data', (chunk: string) => (text += chunk));
        response.on('end', () => done(null, text));
      });
    const body = String(res.body ?? '');
    const events: AiStreamEvent[] = res.headers['content-type']?.startsWith('text/event-stream')
      ? body
          .split('\n\n')
          .filter((block) => block.startsWith('data: '))
          .map((block) => aiStreamEventSchema.parse(JSON.parse(block.slice(6))))
      : [];
    const conversation = events.find((e) => e.type === 'conversation');
    const runs: GradedRun[] = [];
    if (conversation?.type === 'conversation') {
      const { rows } = await this.owner.execute<{
        status: string;
        sql_text: string;
        countries: string[];
        error_code: string | null;
      }>(sql`select status, sql_text, countries::text[] as countries, error_code from ai_sql_runs
             where conversation_id = ${conversation.conversationId} order by created_at`);
      runs.push(
        ...rows.map((r) => ({
          status: r.status,
          sqlText: r.sql_text,
          countries: r.countries.map((code) => code.trim()),
          errorCode: r.error_code,
        })),
      );
    }
    return {
      httpStatus: res.status,
      events,
      answer: events.flatMap((e) => (e.type === 'text' ? [e.delta] : [])).join(''),
      runs,
      logText: this.logLines.slice(firstLog).join('\n'),
      integrityBefore,
      integrityAfter: c.expect.integrity ? await this.integrity() : undefined,
      durationMs: Date.now() - started,
    };
  }

  /** Token use and model calls so far, from the in-process metrics. */
  metrics() {
    return this.container.resolve('aiMetrics').snapshot();
  }

  async close(): Promise<void> {
    await this.container.resolve('db').$client.end();
    await this.container.resolve('aiPool')?.end();
    await this.restoreReader();
    await this.owner.$client.end();
  }
}
