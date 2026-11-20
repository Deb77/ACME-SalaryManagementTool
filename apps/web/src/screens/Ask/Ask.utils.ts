import type { AiStreamEvent, SalaryChangeDraft } from '@acme/shared';
import type { QueryStep } from '../../components';

export interface AskStep extends QueryStep {
  callId: string;
}

export interface AskTurn {
  id: string;
  question: string;
  /** Streamed answer text so far. */
  answer: string;
  steps: AskStep[];
  drafts: SalaryChangeDraft[];
  status: 'streaming' | 'done' | 'error';
  error?: string;
}

function describeCall(tool: string, args: Record<string, unknown>): string {
  return `${tool}(${Object.entries(args)
    .map(([key, value]) => `${key}=${JSON.stringify(value)}`)
    .join(', ')})`;
}

/** Folds one stream event into the turn being answered (pure, so it is easy to test). */
export function applyStreamEvent(turn: AskTurn, event: AiStreamEvent): AskTurn {
  switch (event.type) {
    case 'text':
      return { ...turn, answer: turn.answer + event.delta };
    case 'tool_call':
      return {
        ...turn,
        steps: [
          ...turn.steps,
          {
            callId: event.callId,
            label: event.summary,
            query: describeCall(event.tool, event.args),
            result: 'Running…',
          },
        ],
      };
    case 'tool_result':
      return {
        ...turn,
        steps: turn.steps.map((step) =>
          step.callId === event.callId
            ? { ...step, result: `${event.rowCount} ${event.rowCount === 1 ? 'row' : 'rows'}` }
            : step,
        ),
      };
    case 'draft_salary_change':
      return { ...turn, drafts: [...turn.drafts, event.draft] };
    case 'done':
      return { ...turn, status: 'done' };
    case 'error':
      return { ...turn, status: 'error', error: event.message };
    case 'conversation':
      return turn;
  }
}

/** What the answers cover, e.g. "all countries" or "India, Singapore". */
export function askScopeLabel(
  me: { role: { countryScope: string }; countries: readonly string[] },
  countryName: (code: string) => string,
): string {
  return me.role.countryScope === 'all'
    ? 'all countries'
    : me.countries.map(countryName).join(', ');
}
