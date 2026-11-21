import { describe, expect, it } from 'vitest';
import { sampleDraft } from '../../stories/screenSampleData';
import {
  applyStreamEvent,
  askSuggestions,
  employeeCodesIn,
  parseAnswer,
  parseInline,
  splitByCodes,
  type AskTurn,
} from './Ask.utils';

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
    let next = applyStreamEvent(turn, { type: 'text', delta: "I'll look that up." });
    next = applyStreamEvent(next, {
      type: 'tool_call',
      callId: 'c1',
      tool: 'salary_stats',
      summary: 'Looked up pay',
    });
    expect(next.steps[0]).toEqual({ callId: 'c1', label: 'Looked up pay', result: 'Running…' });
    // The note before the step is not part of the answer.
    expect(next.answer).toBe('');
    next = applyStreamEvent(next, { type: 'tool_result', callId: 'c1', rowCount: 1 });
    next = applyStreamEvent(next, { type: 'text', delta: 'Nine ' });
    next = applyStreamEvent(next, { type: 'text', delta: 'analysts.' });
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

  it('marks a failed step without the database message', () => {
    let next = applyStreamEvent(turn, {
      type: 'tool_call',
      callId: 'c1',
      tool: 'run_sql',
      summary: 'Headcount',
    });
    next = applyStreamEvent(next, {
      type: 'tool_result',
      callId: 'c1',
      rowCount: 0,
      error: 'rejected (forbidden_table)',
    });
    expect(next.steps[0]).toMatchObject({
      label: 'Headcount',
      result: 'Failed',
    });
  });

  it('keeps the error code of a failed answer', () => {
    expect(
      applyStreamEvent(turn, { type: 'error', code: 'ai_budget_exceeded', message: 'Limit' }),
    ).toMatchObject({ errorCode: 'ai_budget_exceeded' });
  });
});

describe('employee codes in answers', () => {
  it('finds each code once and splits text around them', () => {
    const text = 'ACM-000123 earns less than ACM-000045 and ACM-000123.';
    expect(employeeCodesIn(text)).toEqual(['ACM-000123', 'ACM-000045']);
    expect(splitByCodes('Pay ACM-000123 more')).toEqual([
      { text: 'Pay ' },
      { text: 'ACM-000123', code: 'ACM-000123' },
      { text: ' more' },
    ]);
  });
});

describe('parseAnswer', () => {
  it('reads paragraphs, lists and tables, and right-aligns columns of figures', () => {
    const blocks = parseAnswer(
      [
        'India pays least.',
        '',
        '| Country | Median (USD) |',
        '|---|---|',
        '| India | $21,960 |',
        '| UK | $67,945 |',
        '',
        '- **Email:** not visible',
        '- DELETE: read-only',
        '',
        '1. First',
        '2. Second',
      ].join('\n'),
    );
    expect(blocks).toEqual([
      { kind: 'paragraph', text: 'India pays least.' },
      {
        kind: 'table',
        header: ['Country', 'Median (USD)'],
        align: ['left', 'right'],
        rows: [
          ['India', '$21,960'],
          ['UK', '$67,945'],
        ],
      },
      { kind: 'list', ordered: false, items: ['**Email:** not visible', 'DELETE: read-only'] },
      { kind: 'list', ordered: true, items: ['First', 'Second'] },
    ]);
  });

  it('starts a list straight after a paragraph line and keeps a lone pipe line as text', () => {
    expect(parseAnswer('Two things:\n- one\n- two')).toEqual([
      { kind: 'paragraph', text: 'Two things:' },
      { kind: 'list', ordered: false, items: ['one', 'two'] },
    ]);
    expect(parseAnswer('| not a table |')).toEqual([
      { kind: 'paragraph', text: '| not a table |' },
    ]);
  });

  it('honours alignment marks and pads short rows', () => {
    const [table] = parseAnswer('| A | B |\n|:-:|--:|\n| x |');
    expect(table).toEqual({
      kind: 'table',
      header: ['A', 'B'],
      align: ['center', 'right'],
      rows: [['x', '']],
    });
  });
});

describe('parseInline', () => {
  it('finds bold and code, and leaves unclosed markers as text', () => {
    expect(parseInline('**Current:** £75,500 from `fx_rates`')).toEqual([
      { kind: 'strong', text: 'Current:' },
      { kind: 'text', text: ' £75,500 from ' },
      { kind: 'code', text: 'fx_rates' },
    ]);
    expect(parseInline('5 ** 2 and `open')).toEqual([{ kind: 'text', text: '5 ** 2 and `open' }]);
  });
});

describe('askSuggestions', () => {
  const name = (code: string) =>
    ({ IN: 'India', GB: 'United Kingdom', US: 'United States' })[code] ?? code;

  it('only suggests what the user can see', () => {
    const india = askSuggestions({ role: { countryScope: 'assigned' }, countries: ['IN'] }, name);
    expect(india[0]).toBe('What do we pay Data Analysts in India?');
    expect(india.join(' ')).not.toMatch(/United/);

    const ukUs = askSuggestions(
      { role: { countryScope: 'assigned' }, countries: ['GB', 'US'] },
      name,
    );
    expect(ukUs[0]).toBe(
      'What do we pay Data Analysts in United Kingdom compared with United States?',
    );

    const all = askSuggestions({ role: { countryScope: 'all' }, countries: ['IN'] }, name);
    expect(all[0]).toMatch(/India compared with the US and UK/);
  });
});
