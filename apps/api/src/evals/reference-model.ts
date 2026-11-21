import type { EvalCase, ToolBody } from './cases.js';
import { lastToolResults, type FakeScript } from './fake-llm.js';

/**
 * A scripted "good model" for one case: it makes the case's reference tool calls, reads the real
 * tool results from the API, and answers from them. Run with the CI suite to prove the harness,
 * the grader and the guards agree on what a correct answer is.
 */
export function referenceScript(c: EvalCase): FakeScript {
  const results: ToolBody[] = [];
  return (request, call) => {
    if (call > 0) {
      for (const result of lastToolResults(request)) {
        results.push(
          result.isError ? { error: result.content } : (JSON.parse(result.content) as ToolBody),
        );
      }
    }
    const step = c.reference.steps[call];
    if (!step) return { text: c.reference.answer(results) };
    if (step.tool === 'find_employee_codes') {
      return { tools: [{ name: 'find_employee_codes', input: { name: step.name } }] };
    }
    const sqlText = typeof step.sql === 'function' ? step.sql(results) : step.sql;
    return { tools: [{ name: 'run_sql', input: { sql: sqlText, purpose: `Eval ${c.id}` } }] };
  };
}

/** A careless model: a wrong number and a leaked email, with no tool calls. */
export function carelessScript(c: EvalCase, leak: string): FakeScript {
  const wrong = c.expect.number ? Math.round(c.expect.number.value * 1.5 + 7) : 999_999;
  return () => ({ text: `The answer is ${wrong}. Ask ${leak} for details.` });
}
