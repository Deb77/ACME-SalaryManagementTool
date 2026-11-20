/**
 * Canned Ask AI turns, replayed as `aiStreamEventSchema` events. The first question in a
 * conversation gets the fixture transcript (three tool calls, an answer and a draft to
 * approve); later questions get a short answer computed from the in-memory store.
 */
import type { AiStreamEvent, Me, SalaryChangeDraft } from '@acme/shared';
import { formatMoney } from '../lib/money';
import { querySteps } from '../stories/sampleData';
import { sampleDraft } from '../stories/screenSampleData';
import { newId, store, visibleEmployees } from './store';

const firstAnswer =
  'Nine Data Analysts in India earn below the 10th percentile (₹8,50,000). Seven of them have been with ACME for more than three years.\n\nI drafted raises that bring each of them to the 25th percentile. Nothing is saved until you review each one.';

/** The fixture query steps as tool calls (tool name and args parsed from the story text). */
const toolCalls: { tool: string; args: Record<string, unknown>; rowCount: number }[] = [
  {
    tool: 'pay_stats',
    args: { jobTitle: 'data-analyst', countries: ['IN', 'US', 'GB'] },
    rowCount: 3,
  },
  {
    tool: 'list_employees',
    args: { jobTitle: 'data-analyst', country: 'IN', maxSalaryMinor: 85_000_000 },
    rowCount: 9,
  },
  { tool: 'tenure_years', args: { employeeIds: '…9' }, rowCount: 9 },
];

/** Breaks text into small deltas so the streaming UI visibly fills in. */
export function textDeltas(text: string, wordsPerChunk = 3): string[] {
  const words = text.split(/(?<=\s)/);
  const chunks: string[] = [];
  for (let i = 0; i < words.length; i += wordsPerChunk) {
    chunks.push(words.slice(i, i + wordsPerChunk).join(''));
  }
  return chunks;
}

function draftFor(me: Me): SalaryChangeDraft | null {
  // The fixture draft is for Rohan Gupta; take the live amount from the store so the dialog
  // and the detail page agree, and propose a 15% market adjustment.
  const employee =
    store.employees.get(sampleDraft.employeeId) ??
    visibleEmployees(me).find((e) => e.jobTitle.id === 'data-analyst' && e.status === 'active');
  if (!employee || !me.countries.includes(employee.country) || employee.status !== 'active') {
    return null;
  }
  const proposed = Math.round((employee.salary.amountMinor * 1.15) / 100_000) * 100_000;
  return {
    ...sampleDraft,
    draftId: newId(),
    employeeId: employee.id,
    employeeName: `${employee.firstName} ${employee.lastName}`,
    currentAmount: { ...employee.salary },
    proposedAmount: { amountMinor: proposed, currency: employee.salary.currency },
    effectiveDate: new Date().toISOString().slice(0, 10),
  };
}

export function firstTurnEvents(me: Me, conversationId: string): AiStreamEvent[] {
  const events: AiStreamEvent[] = [{ type: 'conversation', conversationId }];
  toolCalls.forEach((call, index) => {
    const callId = `c${index + 1}`;
    events.push({
      type: 'tool_call',
      callId,
      tool: call.tool,
      summary: querySteps[index]?.label ?? call.tool,
      args: call.args,
    });
    events.push({ type: 'tool_result', callId, rowCount: call.rowCount });
  });
  for (const delta of textDeltas(firstAnswer)) events.push({ type: 'text', delta });
  const draft = draftFor(me);
  if (draft) events.push({ type: 'draft_salary_change', draft });
  events.push({ type: 'done' });
  return events;
}

export function followUpEvents(me: Me, conversationId: string, question: string): AiStreamEvent[] {
  const active = visibleEmployees(me).filter((e) => e.status === 'active');
  const byCountry = new Map<string, number[]>();
  for (const e of active)
    byCountry.set(e.country, [...(byCountry.get(e.country) ?? []), e.salary.amountMinor]);
  const lines = [...byCountry.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([country, amounts]) => {
      const sorted = [...amounts].sort((a, b) => a - b);
      const median = sorted[Math.floor(sorted.length / 2)] ?? 0;
      const currency = active.find((e) => e.country === country)?.salary.currency ?? 'USD';
      return `${country}: ${amounts.length} people, median ${formatMoney({ amountMinor: median, currency })}`;
    });
  const answer = `I can only answer from the sample data in this mock, so here is what it holds for "${question.trim()}".\n\nActive employees in your scope: ${active.length}.\n${lines.join('\n')}`;
  return [
    { type: 'conversation', conversationId },
    {
      type: 'tool_call',
      callId: 'c1',
      tool: 'pay_stats',
      summary: 'Headcount and median pay per country in your scope',
      args: { countries: [...byCountry.keys()] },
    },
    { type: 'tool_result', callId: 'c1', rowCount: byCountry.size },
    ...textDeltas(answer).map((delta): AiStreamEvent => ({ type: 'text', delta })),
    { type: 'done' },
  ];
}
