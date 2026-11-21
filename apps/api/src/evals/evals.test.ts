import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildCases, type EvalCase } from './cases.js';
import { FakeLlmClient } from './fake-llm.js';
import { close, extractNumbers, gradeCase } from './grader.js';
import { EvalHarness } from './harness.js';
import { carelessScript, referenceScript } from './reference-model.js';
import { testDatabaseUrl } from '../test/database.js';

/**
 * The CI-safe eval suite: every case runs through the real API, guard and reader role with a
 * scripted model instead of Claude, so it needs no API key. The reference model must pass every
 * case and a careless one must fail every case, which keeps the grader honest. The real-model
 * run is `npm run evals`.
 */
const url = testDatabaseUrl();

describe('grader helpers', () => {
  it('reads numbers the way people write them', () => {
    expect(extractNumbers('We have 1,234 people and $1.5M in pay; ACM-000123 left.')).toEqual([
      1234, 1_500_000,
    ]);
    expect(extractNumbers('The median is ₹18.5 lakh, or 12,34,000.')).toEqual([
      1_850_000, 1_234_000,
    ]);
    expect(close(101, 100, 0.01)).toBe(true);
    expect(close(102, 100, 0.01)).toBe(false);
    expect(close(41, 40)).toBe(false);
  });
});

describe('Ask AI evals (scripted model)', () => {
  let harness: EvalHarness;
  let cases: EvalCase[];
  const fake = new FakeLlmClient(() => ({ text: 'Hello.' }));

  beforeAll(async () => {
    harness = await EvalHarness.start({ databaseUrl: url, llm: fake });
    cases = buildCases(harness.facts);
  }, 180_000);

  afterAll(async () => {
    await harness?.close();
  });

  it('has 20 to 30 cases with unique ids, including adversarial ones', () => {
    expect(cases.length).toBeGreaterThanOrEqual(20);
    expect(cases.length).toBeLessThanOrEqual(30);
    expect(new Set(cases.map((c) => c.id)).size).toBe(cases.length);
    expect(cases.filter((c) => c.category === 'adversarial').length).toBeGreaterThanOrEqual(5);
  });

  it('passes every case with the reference model', async () => {
    const failed: string[] = [];
    for (const c of cases) {
      fake.setScript(referenceScript(c));
      const outcome = await harness.run(c);
      const grade = gradeCase(c, outcome, harness.context(c));
      if (!grade.pass) failed.push(`${c.id}: ${grade.failures.join('; ')} | ${outcome.answer}`);
      if (c.category === 'adversarial') {
        // The hostile SQL was attempted and audited, and never succeeded.
        expect(outcome.runs.length, c.id).toBeGreaterThan(0);
        expect(outcome.runs[0]!.status, c.id).not.toBe('ok');
      }
    }
    expect(failed).toEqual([]);
  }, 120_000);

  it('fails every case with a careless model', async () => {
    const leak = harness.facts.employees[0]!.email;
    const passed: string[] = [];
    for (const c of cases) {
      fake.setScript(carelessScript(c, leak));
      const grade = gradeCase(c, await harness.run(c), harness.context(c));
      if (grade.pass) passed.push(c.id);
    }
    expect(passed).toEqual([]);
  }, 120_000);
});
