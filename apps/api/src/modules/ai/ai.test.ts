import { sql } from 'drizzle-orm';
import pg from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Express } from 'express';
import {
  aiConversationSchema,
  aiMetricsSchema,
  aiSqlRunsResponseSchema,
  aiStreamEventSchema,
  healthResponseSchema,
  type AiStreamEvent,
  type SalaryChangeDraft,
} from '@acme/shared';
import { createApp } from '../../app.js';
import { Argon2Hasher } from '../../auth/password.js';
import type { Config } from '../../config.js';
import { buildServices, type AppServices } from '../../services.js';
import { createDb, type Db } from '../../db/database.js';
import { seedDatabase } from '../../db/seed/seed.js';
import { FakeLlmClient, lastToolResults, type FakeScript } from '../../evals/fake-llm.js';
import { enableTestAiReader, resetAndMigrate } from '../../evals/test-db.js';
import type { Clock } from '../../lib/clock.js';
import { testDatabaseUrl } from '../../test/database.js';

/**
 * Ask AI end to end over HTTP against a real Postgres: the run_sql flow as acme_ai_reader, RLS,
 * column grants, the SQL guard, budgets, fallback, drafts, the SQL audit log and metrics. The
 * model is a scripted fake, so no API key is needed.
 */
const url = testDatabaseUrl();
const ORIGIN = 'http://localhost:5173';
const PASSWORD = 'integration-test-password';
const PRIMARY = 'claude-sonnet-5-5';
const FALLBACK = 'claude-opus-5-5';

type Agent = ReturnType<typeof request.agent>;

/** A clock tests can move; "today" follows it. */
let nowMs = Date.parse('2026-11-20T10:00:00.000Z');
const clock: Clock = {
  now: () => new Date(nowMs),
  today: () => new Date(nowMs).toISOString().slice(0, 10),
};

const sqlStep = (sqlText: string, purpose = 'Count'): FakeScript => {
  return (_req, call) =>
    call === 0
      ? { tools: [{ name: 'run_sql', input: { sql: sqlText, purpose } }] }
      : { text: 'Done.' };
};

interface Logged {
  level: string;
  message: string;
  meta?: Record<string, unknown>;
}

describe('Ask AI', () => {
  let owner: Db;
  let services: AppServices;
  let app: Express;
  let fake: FakeLlmClient;
  let aiUrl: string;
  let restoreReader: () => Promise<void>;
  let indiaHr: Agent;
  let globalHr: Agent;
  let viewer: Agent;
  const logs: Logged[] = [];
  const extraServices: AppServices[] = [];

  const baseConfig = (): Config => ({
    databaseUrl: url,
    allowedOrigins: [ORIGIN],
    appUrl: ORIGIN,
    secureCookies: false,
    dbPoolSize: 4,
    authRateLimit: 1000,
    databaseUrlAi: aiUrl,
    ai: { messagesPerMinute: 1000, messagesPerDay: 10_000, sqlStatementTimeoutMs: 300 },
  });

  function makeApp(config: Config, llm: FakeLlmClient | null) {
    const c = buildServices(config, {
      clock,
      llmClient: llm,
      logger: {
        error: (message, meta) => logs.push({ level: 'error', message, meta }),
        info: (message, meta) => logs.push({ level: 'info', message, meta }),
        warn: (message, meta) => logs.push({ level: 'warn', message, meta }),
      },
    });
    return { services: c, app: createApp({ services: c }) };
  }

  async function signIn(target: Express, email: string): Promise<Agent> {
    const agent = request.agent(target);
    const res = await agent
      .post('/api/auth/sign-in')
      .set('Origin', ORIGIN)
      .send({ email, password: PASSWORD });
    expect(res.status, res.text).toBe(200);
    return agent;
  }

  /** A user with its own role, so budgets and rate limits don't leak between tests. */
  async function makeUser(
    key: string,
    permissions: string[],
    countries: string[],
    target = app,
  ): Promise<Agent> {
    const { rows: roleRows } = await owner.execute<{ id: string }>(sql`
      insert into roles (key, name, country_scope) values (${key}, ${`Test ${key}`}, 'assigned')
      returning id`);
    const roleId = roleRows[0]!.id;
    for (const permission of permissions) {
      await owner.execute(
        sql`insert into role_permissions (role_id, permission_key) values (${roleId}, ${permission})`,
      );
    }
    const hash = await new Argon2Hasher().hash(PASSWORD);
    const email = `${key}@test.acme.test`;
    const { rows: userRows } = await owner.execute<{ id: string }>(sql`
      insert into users (email, name, role_id, status, password_hash)
      values (${email}, ${`User ${key}`}, ${roleId}, 'active', ${hash}) returning id`);
    for (const country of countries) {
      await owner.execute(
        sql`insert into user_countries (user_id, country_code) values (${userRows[0]!.id}, ${country})`,
      );
    }
    return signIn(target, email);
  }

  const ASK_PERMS = ['employees:read', 'insights:read', 'ai:ask'];

  async function ask(
    agent: Agent,
    message: string,
    conversationId?: string,
  ): Promise<{
    status: number;
    events: AiStreamEvent[];
    body: unknown;
    headers: Record<string, string>;
  }> {
    const res = await agent
      .post('/api/ai/messages')
      .set('Origin', ORIGIN)
      .send({ message, ...(conversationId ? { conversationId } : {}) })
      .buffer(true)
      .parse((response, done) => {
        let text = '';
        response.setEncoding('utf8');
        response.on('data', (chunk: string) => (text += chunk));
        response.on('end', () => done(null, text));
      });
    const text = String(res.body ?? '');
    const events =
      res.headers['content-type']?.startsWith('text/event-stream') === true
        ? text
            .split('\n\n')
            .filter((block) => block.startsWith('data: '))
            .map((block) => aiStreamEventSchema.parse(JSON.parse(block.slice(6))))
        : [];
    let body: unknown = text;
    try {
      body = JSON.parse(text);
    } catch {
      // SSE
    }
    return { status: res.status, events, body, headers: res.headers as Record<string, string> };
  }

  const toolResultsOf = (_call?: number) => lastToolResults(fake.requests.at(-1)!);

  async function sqlRuns(where = sql`true`) {
    const { rows } = await owner.execute<{
      status: string;
      error_code: string | null;
      sql_text: string;
      countries: string;
    }>(
      sql`select status, error_code, sql_text, countries::text from ai_sql_runs where ${where} order by created_at`,
    );
    return rows;
  }

  beforeAll(async () => {
    owner = createDb(url, { max: 2 });
    await resetAndMigrate(owner);
    await seedDatabase(owner, {
      employees: 400,
      seed: 11,
      asOf: '2026-11-01',
      reset: true,
      demoUsers: true,
      demoPassword: PASSWORD,
      log: () => {},
    });
    const reader = await enableTestAiReader(owner, url);
    aiUrl = reader.url;
    restoreReader = reader.restore;
    fake = new FakeLlmClient(() => ({ text: 'Hello.' }));
    ({ services, app } = makeApp(baseConfig(), fake));
    indiaHr = await signIn(app, 'india.hr@demo.acme.test');
    globalHr = await signIn(app, 'global.hr@demo.acme.test');
    viewer = await makeUser('ai_viewer', ASK_PERMS, ['IN']);
  }, 120_000);

  beforeEach(() => {
    fake.requests.length = 0;
  });

  afterAll(async () => {
    for (const c of [services, ...extraServices]) {
      await c?.db.$client.end();
      await c?.aiPool?.end();
    }
    await restoreReader?.();
    await owner?.$client.end();
  });

  describe('database role acme_ai_reader', () => {
    it('is not superuser or owner, cannot bypass RLS and defaults to read-only', async () => {
      const { rows } = await owner.execute<{
        rolsuper: boolean;
        rolbypassrls: boolean;
        rolcreaterole: boolean;
        rolcreatedb: boolean;
        rolconfig: string[] | null;
      }>(sql`select rolsuper, rolbypassrls, rolcreaterole, rolcreatedb, rolconfig
               from pg_roles where rolname = 'acme_ai_reader'`);
      expect(rows[0]).toMatchObject({
        rolsuper: false,
        rolbypassrls: false,
        rolcreaterole: false,
        rolcreatedb: false,
      });
      expect(rows[0]!.rolconfig).toEqual(
        expect.arrayContaining(['default_transaction_read_only=on', 'statement_timeout=5s']),
      );
      const owned = await owner.execute<{ n: number }>(sql`
        select count(*)::int as n from pg_class c join pg_roles r on r.oid = c.relowner
         where r.rolname = 'acme_ai_reader'`);
      expect(owned.rows[0]!.n).toBe(0);
    });

    it('cannot write, create, use temp tables or read private tables, even past the guard', async () => {
      const client = new pg.Client({ connectionString: aiUrl });
      await client.connect();
      try {
        const attempts = [
          `insert into countries (code, name, currency, minor_units) values ('ZZ','Z','ZZZ',2)`,
          'create table t (x int)',
          'create temp table t (x int)',
          'select * from users',
          'select * from ai_sql_runs',
          'select * from app_private.ai_scope',
          `insert into app_private.ai_scope values (pg_backend_pid(), '{GB}', now() + interval '1h')`,
          'select first_name from employees',
          'select email from employees',
          'select note from salary_changes',
          'set role acme_app',
        ];
        for (const attempt of attempts) {
          await expect(client.query(attempt), attempt).rejects.toThrow(
            /permission denied|read-only|must be|does not exist/,
          );
        }
        // Writes are refused even with read-only switched off for the session.
        await client.query('set default_transaction_read_only = off');
        await expect(client.query(`update employees set salary_amount_minor = 1`)).rejects.toThrow(
          /permission denied/,
        );
      } finally {
        await client.end();
      }
    });

    it('takes its scope from ai_scope by backend PID, not from settings it can change', async () => {
      const client = new pg.Client({ connectionString: aiUrl });
      await client.connect();
      try {
        const pid = (await client.query<{ pid: number }>('select pg_backend_pid() as pid')).rows[0]!
          .pid;
        // No scope row: nothing visible.
        expect((await client.query('select count(*)::int as n from employees')).rows[0].n).toBe(0);
        await owner.execute(sql`insert into app_private.ai_scope values
          (${pid}, '{IN}', now() + interval '30 seconds')`);
        await client.query('begin read only');
        await client.query(`select set_config('app.countries', 'GB,US', true)`);
        await client.query(`select set_config('app.all_countries', 'on', true)`);
        const { rows } = await client.query<{ country_code: string }>(
          'select distinct country_code from employees',
        );
        expect(rows.map((r) => r.country_code)).toEqual(['IN']);
        await client.query('rollback');
        // An expired row is ignored.
        await owner.execute(
          sql`update app_private.ai_scope set expires_at = now() - interval '1 second' where backend_pid = ${pid}`,
        );
        expect((await client.query('select count(*)::int as n from employees')).rows[0].n).toBe(0);
      } finally {
        await owner.execute(sql`delete from app_private.ai_scope`);
        await client.end();
      }
    });
  });

  describe('run_sql', () => {
    it('answers a Country HR count from India only, and leaves no scope row behind', async () => {
      fake.setScript(
        sqlStep('select country_code, count(*) as n from employees group by country_code'),
      );
      const res = await ask(indiaHr, 'How many employees per country?');
      expect(res.status).toBe(200);
      expect(res.events.map((e) => e.type)).toEqual([
        'conversation',
        'tool_call',
        'tool_result',
        'text',
        'done',
      ]);
      const call = res.events.find((e) => e.type === 'tool_call');
      expect(call).toMatchObject({ tool: 'run_sql', summary: expect.any(String) });
      // The SQL stays on the server (audit log only); the browser gets the summary.
      expect(JSON.stringify(call)).not.toMatch(/select/i);
      const result = JSON.parse(toolResultsOf(1)[0]!.content) as { rows: [string, string][] };
      const { rows } = await owner.execute<{ n: string }>(
        sql`select count(*) as n from employees where country_code = 'IN'`,
      );
      expect(result.rows).toEqual([['IN', rows[0]!.n]]);
      const left = await owner.execute(sql`select * from app_private.ai_scope`);
      expect(left.rows).toEqual([]);
    });

    it('returns dates as written, whatever the server time zone', async () => {
      const tz = process.env.TZ;
      process.env.TZ = 'Asia/Kolkata'; // east of UTC: the case that moved dates a day back
      try {
        fake.setScript(
          sqlStep(`select date '2026-08-28' as d, timestamp '2026-08-28 09:00:00' as t`),
        );
        await ask(indiaHr, 'When?');
        const result = JSON.parse(toolResultsOf(1)[0]!.content) as { rows: string[][] };
        expect(result.rows).toEqual([['2026-08-28', '2026-08-28 09:00:00']]);
      } finally {
        if (tz === undefined) delete process.env.TZ;
        else process.env.TZ = tz;
      }
    });

    it('stays in India when the SQL tries to change the scope', async () => {
      fake.setScript(sqlStep(`select set_config('app.countries', 'GB', true)`));
      await ask(indiaHr, 'Widen my scope');
      expect(toolResultsOf(1)[0]).toMatchObject({ isError: true });
      expect(toolResultsOf(1)[0]!.content).toMatch(/forbidden_function/);

      fake.setScript(sqlStep(`select count(*) as n from employees where country_code = 'GB'`));
      await ask(indiaHr, 'Count UK staff');
      expect(JSON.parse(toolResultsOf(1)[0]!.content).rows).toEqual([['0']]);

      fake.setScript(
        sqlStep(
          `with s as (select 1) select count(*) from salary_changes where country_code <> 'IN'`,
        ),
      );
      await ask(indiaHr, 'Count history outside India');
      expect(JSON.parse(toolResultsOf(1)[0]!.content).rows).toEqual([['0']]);
    });

    it('surfaces a denied column as a tool error, not a crash', async () => {
      fake.setScript(sqlStep('select first_name from employees'));
      const res = await ask(indiaHr, 'List first names');
      expect(res.status).toBe(200);
      expect(res.events.at(-1)).toEqual({ type: 'done' });
      const result = toolResultsOf(1)[0]!;
      expect(result.isError).toBe(true);
      expect(result.content).toMatch(/permission_denied/);
      const runs = await sqlRuns(sql`sql_text = 'select first_name from employees'`);
      expect(runs[0]).toMatchObject({ status: 'error', error_code: 'permission_denied' });
    });

    it.each([
      ['select * from users', 'forbidden_table'],
      ['set role acme_app', 'not_select'],
      ['reset role', 'not_select'],
      ['select 1; select 2', 'not_single_statement'],
      [`insert into countries values ('ZZ','Z','ZZZ',2)`, 'not_select'],
      ['with d as (delete from employees returning id) select count(*) from d', 'not_select'],
      ['select * from pg_catalog.pg_roles', 'forbidden_table'],
      ['select pg_sleep(10)', 'forbidden_function'],
      ['select country_code from employees for update', 'forbidden_clause'],
      ['select 1::regclass', 'forbidden_type'],
    ])('rejects %s before it reaches the database, and logs it', async (sqlText, code) => {
      const pool = services.aiPool!;
      const connect = vi.spyOn(pool, 'connect');
      fake.setScript(sqlStep(sqlText));
      const res = await ask(indiaHr, 'Try this');
      expect(res.status).toBe(200);
      expect(toolResultsOf(1)[0]!.content).toMatch(new RegExp(`rejected \\(${code}\\)`));
      expect(connect).not.toHaveBeenCalled();
      connect.mockRestore();
      const runs = await sqlRuns(sql`sql_text = ${sqlText}`);
      expect(runs.at(-1)).toMatchObject({
        status: 'rejected',
        error_code: code,
        countries: '{IN}',
      });
    });

    it('caps the rows the model gets', async () => {
      fake.setScript(sqlStep('select n from generate_series(1, 500) as n'));
      await ask(indiaHr, 'Many rows');
      const result = JSON.parse(toolResultsOf(1)[0]!.content);
      expect(result.rowCount).toBe(200);
      expect(result.truncated).toBe(true);
    });

    it('records a timeout', async () => {
      fake.setScript(sqlStep('select count(*) from generate_series(1, 200000000) as n'));
      await ask(indiaHr, 'Slow');
      expect(toolResultsOf(1)[0]!.content).toMatch(/timeout/);
      const runs = await sqlRuns(sql`status = 'timeout'`);
      expect(runs).toHaveLength(1);
    });
  });

  describe('names and codes', () => {
    it('finds codes for a typed name, never names, and logs no names or questions', async () => {
      const { rows } = await owner.execute<{ first: string; last: string; code: string }>(sql`
        select first_name as first, last_name as last, employee_code as code from employees
         where country_code = 'IN' order by employee_code limit 1`);
      const person = rows[0]!;
      fake.setScript((_req, call) =>
        call === 0
          ? {
              tools: [
                { name: 'find_employee_codes', input: { name: `${person.first} ${person.last}` } },
              ],
            }
          : { text: `That is ${person.code}.` },
      );
      logs.length = 0;
      const question = `What does ${person.first} ${person.last} earn?`;
      await ask(indiaHr, question);
      const result = JSON.parse(toolResultsOf(1)[0]!.content);
      expect(result.matches.map((m: { employeeCode: string }) => m.employeeCode)).toContain(
        person.code,
      );
      expect(JSON.stringify(result)).not.toContain(person.last);
      const logged = JSON.stringify(logs);
      expect(logged).not.toContain(person.last);
      expect(logged).not.toContain(question);
      expect(logged).not.toMatch(/@acme|sk-ant/);
      expect(logs.some((l) => l.message === 'ai.turn')).toBe(true);
    });
  });

  describe('conversations', () => {
    it('reloads your own conversation and hides it from others', async () => {
      fake.setScript(sqlStep('select count(*) from employees', 'Headcount'));
      const res = await ask(indiaHr, 'Headcount?');
      const id = (res.events[0] as { conversationId: string }).conversationId;
      const own = await indiaHr.get(`/api/ai/conversations/${id}`);
      expect(own.status).toBe(200);
      const conversation = aiConversationSchema.parse(own.body);
      expect(conversation.turns).toHaveLength(1);
      expect(conversation.turns[0]).toMatchObject({
        question: 'Headcount?',
        answer: 'Done.',
        steps: [{ tool: 'run_sql', summary: 'Headcount', rowCount: 1 }],
      });
      expect((await globalHr.get(`/api/ai/conversations/${id}`)).status).toBe(404);
      fake.setScript(() => ({ text: 'x' }));
      expect((await ask(globalHr, 'Continue', id)).status).toBe(404);
    });
  });

  describe('drafts', () => {
    let nextOffset = 5;
    async function draftFor(agent: Agent, country = 'IN') {
      const offset = nextOffset++;
      const { rows } = await owner.execute<{
        id: string;
        code: string;
        salary: number;
        version: number;
      }>(sql`
        select id, employee_code as code, salary_amount_minor::float8 as salary, version
          from employees where country_code = ${country} and status = 'active'
         order by employee_code offset ${offset} limit 1`);
      const employee = rows[0]!;
      fake.setScript((_req, call) =>
        call === 0
          ? {
              tools: [
                {
                  name: 'draft_salary_change',
                  input: {
                    employeeCode: employee.code,
                    proposedAmountMinor: employee.salary + 100_000,
                    effectiveDate: clock.today(),
                    reason: 'market_adjustment',
                  },
                },
              ],
            }
          : { text: 'Drafted.' },
      );
      const res = await ask(agent, 'Draft a raise');
      const event = res.events.find((e) => e.type === 'draft_salary_change') as
        { draft: SalaryChangeDraft } | undefined;
      return { employee, draft: event?.draft };
    }

    const apply = (agent: Agent, employeeId: string, draft: SalaryChangeDraft, version: number) =>
      agent.post(`/api/employees/${employeeId}/salary-changes`).set('Origin', ORIGIN).send({
        amountMinor: draft.proposedAmount.amountMinor,
        effectiveDate: draft.effectiveDate,
        reason: draft.reason,
        version,
        aiDraftId: draft.draftId,
      });

    const currentVersion = async (id: string) =>
      (await owner.execute<{ v: number }>(sql`select version as v from employees where id = ${id}`))
        .rows[0]!.v;

    it('offers the draft tool only with salary:change', async () => {
      fake.setScript(() => ({ text: 'ok' }));
      await ask(viewer, 'Hi');
      expect(fake.requests[0]!.tools.map((t) => t.name)).toEqual([
        'run_sql',
        'find_employee_codes',
      ]);
      await ask(indiaHr, 'Hi');
      expect(fake.requests[1]!.tools.map((t) => t.name)).toContain('draft_salary_change');
    });

    it('applies a draft once; the second time is a 409', async () => {
      const { employee, draft } = await draftFor(indiaHr);
      expect(draft).toMatchObject({
        employeeCode: employee.code,
        employeeName: expect.any(String),
      });
      const first = await apply(indiaHr, employee.id, draft!, employee.version);
      expect(first.status, first.text).toBe(201);
      expect(first.body.salaryChange.aiDraftId).toBe(draft!.draftId);
      const audit = await owner.execute<{ details: { aiDraftId: string } }>(sql`
        select details from audit_events where entity_id = ${employee.id} and action = 'salary.changed'`);
      expect(audit.rows.at(-1)!.details.aiDraftId).toBe(draft!.draftId);

      const again = await apply(indiaHr, employee.id, draft!, await currentVersion(employee.id));
      expect(again.status).toBe(409);
      expect(again.body.error.code).toBe('draft_applied');
    });

    it("refuses another user's draft as not found", async () => {
      const { employee, draft } = await draftFor(indiaHr);
      const res = await apply(globalHr, employee.id, draft!, employee.version);
      expect(res.status).toBe(404);
    });

    it('is stale once the employee changed', async () => {
      const { employee, draft } = await draftFor(indiaHr);
      await owner.execute(
        sql`update employees set version = version + 1 where id = ${employee.id}`,
      );
      const res = await apply(indiaHr, employee.id, draft!, employee.version + 1);
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('draft_stale');
    });

    it('is stale after 7 days', async () => {
      // Draft 8 days ago (moving the clock forward instead would also expire the session).
      const saved = nowMs;
      nowMs -= 8 * 24 * 60 * 60 * 1000;
      let drafted: Awaited<ReturnType<typeof draftFor>>;
      try {
        drafted = await draftFor(indiaHr);
      } finally {
        nowMs = saved;
      }
      const res = await apply(
        indiaHr,
        drafted.employee.id,
        drafted.draft!,
        drafted.employee.version,
      );
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('draft_stale');
    });
  });

  describe('models, budgets and limits', () => {
    it('falls back to the second model when the first fails before any text', async () => {
      fake.setScript((req) =>
        req.model === PRIMARY ? { fail: 'api_error' } : { text: 'From the fallback.' },
      );
      const res = await ask(indiaHr, 'Hello');
      expect(res.status).toBe(200);
      expect(res.events.at(-1)).toEqual({ type: 'done' });
      expect(fake.requests.map((r) => r.model)).toEqual([PRIMARY, FALLBACK]);
      const turn = logs.filter((l) => l.message === 'ai.turn').at(-1);
      expect(turn?.meta).toMatchObject({ fallbackUsed: true, 'gen_ai.response.model': FALLBACK });
    });

    it('answers 503 when both models fail before the stream starts', async () => {
      fake.setScript(() => ({ fail: 'timeout' }));
      const res = await ask(indiaHr, 'Hello');
      expect(res.status).toBe(503);
      expect((res.body as { error: { code: string } }).error.code).toBe('ai_unavailable');
    });

    it('sends an error event when the model fails after text, without switching', async () => {
      fake.setScript(() => ({ text: 'Partial', fail: 'api_error', failAfterText: true }));
      const res = await ask(indiaHr, 'Hello');
      expect(res.status).toBe(200);
      expect(res.events.at(-1)).toMatchObject({ type: 'error', code: 'ai_unavailable' });
      expect(fake.requests).toHaveLength(1);
    });

    it('keeps room for the answer: a step that runs out of tokens is followed by an answer', async () => {
      fake.setScript((_req, call) =>
        call === 0
          ? {
              tools: [{ name: 'run_sql', input: { sql: 'select 1', purpose: 'Count' } }],
              stopReason: 'max_tokens',
              usage: { outputTokens: 2_400 },
            }
          : { text: 'Here is what I found.' },
      );
      const res = await ask(indiaHr, 'Draft raises for everyone');
      expect(fake.requests[0]!.maxTokens).toBe(6_000);
      expect(fake.requests[1]).toMatchObject({
        toolChoice: { type: 'none' },
        effort: 'low',
        maxTokens: 3_600,
      });
      expect(toolResultsOf(1)[0]!.content).toMatch(/out of room for more steps/);
      expect(res.events.at(-1)).toEqual({ type: 'done' });
    });

    it('runs the tool calls that arrived whole when the limit cuts the last one', async () => {
      fake.setScript((_req, call) =>
        call === 0
          ? {
              tools: [
                { name: 'run_sql', input: { sql: 'select 1', purpose: 'First' } },
                { name: 'run_sql', input: { sql: 'select', purpose: 'Cut' } },
              ],
              stopReason: 'max_tokens',
              usage: { outputTokens: 5_000 },
            }
          : { text: 'Answer.' },
      );
      const res = await ask(indiaHr, 'Many steps');
      const results = toolResultsOf(1);
      expect(results[0]!.isError).toBe(false);
      expect(results[1]!.content).toMatch(/out of room for more steps/);
      // The answer still gets the full reserve although the steps used more than their share.
      expect(fake.requests[1]).toMatchObject({ toolChoice: { type: 'none' }, maxTokens: 2_000 });
      expect(res.events.at(-1)).toEqual({ type: 'done' });
    });

    it('answers again, tool-free, when a reply spent its tokens thinking', async () => {
      fake.setScript((_req, call) =>
        call === 0
          ? { stopReason: 'max_tokens', usage: { outputTokens: 4_000 } }
          : { text: 'The summary.' },
      );
      const res = await ask(indiaHr, 'A long committee question');
      expect(fake.requests).toHaveLength(2);
      expect(fake.requests[1]).toMatchObject({ toolChoice: { type: 'none' }, effort: 'low' });
      expect(res.events.at(-1)).toEqual({ type: 'done' });
    });

    it('says an answer was cut off at its length limit instead of ending mid-sentence', async () => {
      fake.setScript(() => ({ text: '1. ACM-000001 – $208,', stopReason: 'max_tokens' }));
      const res = await ask(indiaHr, 'List the 100 highest paid');
      const text = res.events
        .filter((e): e is { type: 'text'; delta: string } => e.type === 'text')
        .map((e) => e.delta)
        .join('');
      expect(text).toMatch(/\(The answer was cut off at its length limit\./);
      expect(res.events.at(-1)).toEqual({ type: 'done' });
    });

    it('sends an error, never a bare done, when the model writes no answer', async () => {
      // Nothing was streamed, so it is a plain HTTP error the app shows as "No answer".
      fake.setScript(() => ({}));
      const empty = await ask(indiaHr, 'Hello');
      expect(empty.status).toBe(502);
      expect((empty.body as { error: { code: string } }).error.code).toBe('ai_no_answer');

      // After a step the stream is open, so it ends with an error event instead of done.
      fake.setScript((_req, call) =>
        call === 0
          ? { tools: [{ name: 'run_sql', input: { sql: 'select 1', purpose: 'Count' } }] }
          : {},
      );
      const afterStep = await ask(indiaHr, 'Hello');
      expect(afterStep.events.at(-1)).toMatchObject({ type: 'error', code: 'ai_no_answer' });
      expect(afterStep.events.some((e) => e.type === 'done')).toBe(false);
    });

    it('stops a conversation over its token budget', async () => {
      const agent = await makeUser('ai_budget_conv', ASK_PERMS, ['IN']);
      fake.setScript(() => ({ text: 'Long.', usage: { inputTokens: 160_000 } }));
      const first = await ask(agent, 'One');
      const id = (first.events[0] as { conversationId: string }).conversationId;
      const second = await ask(agent, 'Two', id);
      expect(second.status).toBe(429);
      expect((second.body as { error: { code: string; message: string } }).error).toMatchObject({
        code: 'ai_budget_exceeded',
        message: expect.stringContaining('Start a new conversation'),
      });
    });

    it("stops a user over today's token budget", async () => {
      const agent = await makeUser('ai_budget_day', ASK_PERMS, ['IN']);
      fake.setScript(() => ({
        text: 'Huge.',
        usage: { inputTokens: 140_000, outputTokens: 900_000 },
      }));
      await ask(agent, 'One');
      const second = await ask(agent, 'Two');
      expect(second.status).toBe(429);
      expect((second.body as { error: { code: string } }).error.code).toBe('ai_budget_exceeded');
    });

    it('limits a user to 20 messages a minute', async () => {
      const limited = makeApp(
        { ...baseConfig(), ai: {} },
        new FakeLlmClient(() => ({ text: 'k' })),
      );
      extraServices.push(limited.services);
      const agent = await makeUser('ai_rate', ASK_PERMS, ['IN'], limited.app);
      for (let i = 0; i < 20; i++) {
        expect((await ask(agent, `q${i}`)).status).toBe(200);
      }
      const res = await ask(agent, 'one too many');
      expect(res.status).toBe(429);
      expect(res.headers['retry-after']).toBeDefined();
      const other = await signIn(limited.app, 'india.hr@demo.acme.test');
      expect((await ask(other, 'not limited')).status).toBe(200);
    });

    it('answers 503 without an API key while the rest of the app works', async () => {
      const keyless = makeApp(baseConfig(), null);
      extraServices.push(keyless.services);
      const agent = await signIn(keyless.app, 'india.hr@demo.acme.test');
      const res = await ask(agent, 'Hello');
      expect(res.status).toBe(503);
      expect((res.body as { error: { code: string } }).error.code).toBe('ai_unavailable');
      const list = await agent.get('/api/employees');
      expect(list.status, list.text).toBe(200);
      const health = healthResponseSchema.parse(
        (await request(keyless.app).get('/api/health')).body,
      );
      expect(health.ai).toEqual({ configured: false, database: 'ok' });
    });
  });

  describe('SQL audit log and metrics', () => {
    it('shows Country HR their own runs and all-country admins every run', async () => {
      fake.setScript(sqlStep('select count(*) from countries'));
      await ask(indiaHr, 'Countries?');
      await ask(globalHr, 'Countries?');
      for (const attempt of ['select * from users', 'select 1; select 2', 'reset role']) {
        fake.setScript(sqlStep(attempt));
        await ask(globalHr, 'Try this');
      }
      const india = aiSqlRunsResponseSchema.parse((await indiaHr.get('/api/ai/sql-runs')).body);
      expect(india.items.length).toBeGreaterThan(0);
      expect(new Set(india.items.map((r) => r.user.name))).toEqual(new Set(['India HR (demo)']));
      const all = aiSqlRunsResponseSchema.parse(
        (await globalHr.get('/api/ai/sql-runs?limit=100')).body,
      );
      const names = new Set(all.items.map((r) => r.user.name));
      expect(names).toContain('India HR (demo)');
      expect(names).toContain('Global HR (demo)');
      const rejected = aiSqlRunsResponseSchema.parse(
        (await globalHr.get('/api/ai/sql-runs?status=rejected&limit=2')).body,
      );
      expect(rejected.items.every((r) => r.status === 'rejected')).toBe(true);
      expect(rejected.nextCursor).not.toBeNull();
      const next = await globalHr.get(
        `/api/ai/sql-runs?status=rejected&limit=2&cursor=${rejected.nextCursor}`,
      );
      expect(next.status).toBe(200);
      expect((await viewer.get('/api/ai/sql-runs')).status).toBe(403);
    });

    it('keeps the audit log append-only for the API role', async () => {
      await expect(
        owner.transaction(async (tx) => {
          await tx.execute(sql`set local role acme_app`);
          await tx.execute(sql`delete from ai_sql_runs`);
        }),
      ).rejects.toMatchObject({ cause: { code: '42501' } });
    });

    it('serves metrics to administrators only', async () => {
      fake.setScript(sqlStep('select * from users'));
      await ask(indiaHr, 'Try this');
      fake.setScript((req) =>
        req.model === PRIMARY ? { fail: 'api_error' } : { text: 'From the fallback.' },
      );
      await ask(indiaHr, 'Hello');
      const res = await globalHr.get('/api/ai/metrics');
      expect(res.status).toBe(200);
      const metrics = aiMetricsSchema.parse(res.body);
      expect(metrics.counters.ai_turns_total).toBeGreaterThan(0);
      expect(metrics.counters['ai_sql_runs_total{status="rejected"}']).toBeGreaterThan(0);
      expect(metrics.counters.ai_fallback_total).toBeGreaterThan(0);
      expect((await indiaHr.get('/api/ai/metrics')).status).toBe(403);
    });

    it('serves Prometheus text only with the metrics token', async () => {
      const withToken = makeApp({ ...baseConfig(), metricsToken: 'test-metrics-token' }, fake);
      extraServices.push(withToken.services);
      expect((await request(withToken.app).get('/metrics')).status).toBe(401);
      const ok = await request(withToken.app)
        .get('/metrics')
        .set('Authorization', 'Bearer test-metrics-token');
      expect(ok.status).toBe(200);
      expect(ok.text).toContain('# TYPE acme_ai_window_error_rate gauge');
      expect((await request(app).get('/metrics')).status).toBe(404);
    });
  });
});
