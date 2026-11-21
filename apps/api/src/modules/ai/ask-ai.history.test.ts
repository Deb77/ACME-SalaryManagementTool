import { describe, expect, it } from 'vitest';
import type { AiMessageRow } from './ai.repository.js';
import { historyToMessages, INTERRUPTED_NOTE } from './ask-ai.service.js';

const row = (role: AiMessageRow['role'], content: unknown) => ({ role, content }) as AiMessageRow;
const question = (text: string) => [{ type: 'text' as const, text }];

describe('historyToMessages', () => {
  it('sends a finished conversation as it was, then the new question', () => {
    const messages = historyToMessages(
      [row('user', question('Headcount?')), row('assistant', [{ type: 'text', text: '40.' }])],
      question('And in India?'),
    );
    expect(messages.map((m) => m.role)).toEqual(['user', 'assistant', 'user']);
    expect(messages.at(-1)!.content).toEqual(question('And in India?'));
  });

  it('tells the model when the question follows an answer that was cut off after a step', () => {
    const toolUse = { type: 'tool_use', id: 't1', name: 'run_sql', input: {} };
    const toolResult = { type: 'tool_result', tool_use_id: 't1', content: '[]' };
    const messages = historyToMessages(
      [
        row('user', question('Top earners?')),
        row('assistant', [toolUse]),
        row('tool', [toolResult]),
      ],
      question('How many people are in Germany?'),
    );
    expect(messages.at(-2)).toEqual({ role: 'user', content: [toolResult] });
    expect(messages.at(-1)!.content).toEqual([
      { type: 'text', text: INTERRUPTED_NOTE },
      ...question('How many people are in Germany?'),
    ]);
  });
});
