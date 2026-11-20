import { describe, expect, it } from 'vitest';
import { parseSseBuffer } from './askStream';

describe('parseSseBuffer', () => {
  it('parses complete events and keeps the incomplete tail', () => {
    const buffer =
      'data: {"type":"text","delta":"In India "}\n\n' +
      'data: {"type":"tool_result","callId":"c1","rowCount":2}\n\n' +
      'data: {"type":"te';

    const { events, rest } = parseSseBuffer(buffer);

    expect(events).toEqual([
      { type: 'text', delta: 'In India ' },
      { type: 'tool_result', callId: 'c1', rowCount: 2 },
    ]);
    expect(rest).toBe('data: {"type":"te');
  });

  it('skips events that are not valid JSON or not in the contract', () => {
    const { events } = parseSseBuffer(
      'data: not json\n\ndata: {"type":"mystery"}\n\ndata: {"type":"done"}\n\n',
    );

    expect(events).toEqual([{ type: 'done' }]);
  });
});
