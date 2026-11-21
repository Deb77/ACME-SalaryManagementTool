import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { aiSettings, loadConfig, type Config } from '../config.js';
import { buildCases } from './cases.js';
import { gradeCase } from './grader.js';
import { EvalHarness } from './harness.js';

/**
 * `npm run evals`: the eval cases against the real model. Needs ANTHROPIC_API_KEY and a throwaway
 * database (EVAL_DATABASE_URL, else TEST_DATABASE_URL) that it resets and seeds. Prints a table,
 * writes a JSON report to apps/api/eval-results/ (gitignored) and exits 1 when the pass rate is
 * under EVAL_PASS_THRESHOLD (default 0.8). Optional: EVAL_CASES=id1,id2 to run a subset.
 */
async function main(): Promise<number> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const databaseUrl = process.env.EVAL_DATABASE_URL || process.env.TEST_DATABASE_URL;
  if (!apiKey || !databaseUrl) {
    console.error(
      'Set ANTHROPIC_API_KEY and EVAL_DATABASE_URL (or TEST_DATABASE_URL) to run the evals.',
    );
    return 2;
  }
  const threshold = Number(process.env.EVAL_PASS_THRESHOLD ?? '0.8');
  const only = process.env.EVAL_CASES?.split(',').filter(Boolean);
  // Model and budget overrides come from the same AI_* env vars as the server.
  const ai = envAiSettings(databaseUrl);
  const settings = aiSettings({ ...minimalConfig, ai });

  const harness = await EvalHarness.start({ databaseUrl, llm: null, anthropicApiKey: apiKey, ai });
  const results = [];
  try {
    const cases = buildCases(harness.facts).filter((c) => !only || only.includes(c.id));
    for (const c of cases) {
      const outcome = await harness.run(c);
      const grade = gradeCase(c, outcome, harness.context(c));
      results.push({
        id: c.id,
        category: c.category,
        user: c.user,
        pass: grade.pass,
        failures: grade.failures,
        answer: outcome.answer,
        sql: outcome.runs.map((r) => ({
          status: r.status,
          errorCode: r.errorCode,
          sql: r.sqlText,
        })),
        durationMs: outcome.durationMs,
      });
      console.log(
        `${grade.pass ? 'PASS' : 'FAIL'}  ${c.id.padEnd(26)} ${grade.failures.join('; ')}`,
      );
    }
  } finally {
    const metrics = harness.metrics();
    await harness.close();
    const passed = results.filter((r) => r.pass).length;
    const rate = results.length ? passed / results.length : 0;
    console.table(
      results.map((r) => ({
        case: r.id,
        category: r.category,
        pass: r.pass ? 'yes' : 'NO',
        ms: r.durationMs,
      })),
    );
    console.log(
      `Passed ${passed}/${results.length} (${(rate * 100).toFixed(0)} %), threshold ${threshold * 100} %.`,
    );
    const dir = fileURLToPath(new URL('../../eval-results/', import.meta.url));
    await mkdir(dir, { recursive: true });
    const file = `${dir}evals-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    await writeFile(
      file,
      JSON.stringify(
        {
          ranAt: new Date().toISOString(),
          models: { primary: settings.modelPrimary, fallback: settings.modelFallback },
          passRate: rate,
          threshold,
          metrics,
          results,
        },
        null,
        2,
      ),
    );
    console.log(`Report: ${file}`);
    process.exitCode = rate >= threshold ? 0 : 1;
  }
  return Number(process.exitCode ?? 0);
}

const minimalConfig: Config = {
  databaseUrl: '',
  allowedOrigins: [],
  appUrl: '',
  secureCookies: false,
  dbPoolSize: 1,
};

function envAiSettings(databaseUrl: string): Config['ai'] {
  try {
    return loadConfig({ ...process.env, DATABASE_URL: process.env.DATABASE_URL || databaseUrl }).ai;
  } catch {
    return undefined;
  }
}

process.exitCode = await main();
