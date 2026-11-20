import { describe, expect, it } from 'vitest';
import { sampleDraft } from '../../stories/screenSampleData';
import { applyStreamEvent, type AskTurn } from './Ask.utils';

const turn: AskTurn = {
  id: 't',
  question: 'q',
  answer: '',
  steps: [],
  drafts: [],
  status: 'streaming',
};

describe('applyStreamEvent', () => {
  it('appends text, tracks tool calls and their results, and collects drafts', () => {
    let next = applyStreamEvent(turn, { type: 'text', delta: 'Nine ' });
    next = applyStreamEvent(next, { type: 'text', delta: 'analysts.' });
    next = applyStreamEvent(next, {
      type: 'tool_call',
      callId: 'c1',
      tool: 'salary_stats',
      summary: 'Looked up pay',
      args: { country: 'IN' },
    });
    expect(next.steps[0]).toMatchObject({
      label: 'Looked up pay',
      query: 'salary_stats(country="IN")',
      result: 'Running…',
    });
    next = applyStreamEvent(next, { type: 'tool_result', callId: 'c1', rowCount: 1 });
    next = applyStreamEvent(next, { type: 'draft_salary_change', draft: sampleDraft });
    next = applyStreamEvent(next, { type: 'done' });

    expect(next).toMatchObject({ answer: 'Nine analysts.', status: 'done', drafts: [sampleDraft] });
    expect(next.steps[0]?.result).toBe('1 row');
  });

  it('records a stream error', () => {
    expect(
      applyStreamEvent(turn, { type: 'error', code: 'ai_unavailable', message: 'Down' }),
    ).toMatchObject({
      status: 'error',
      error: 'Down',
    });
  });
});
