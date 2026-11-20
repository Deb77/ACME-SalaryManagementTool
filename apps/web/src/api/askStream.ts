import { aiStreamEventSchema, type AiStreamEvent, type AskAiRequest } from '@acme/shared';
import { API_BASE, ApiError, toApiError } from './client';

/**
 * Splits a Server-Sent Events buffer into complete events. Returns the parsed `data:`
 * payloads and the incomplete tail to prepend to the next chunk. Unknown or malformed
 * events are skipped rather than breaking the answer.
 */
export function parseSseBuffer(buffer: string): { events: AiStreamEvent[]; rest: string } {
  const blocks = buffer.replace(/\r\n/g, '\n').split('\n\n');
  const rest = blocks.pop() ?? '';
  const events: AiStreamEvent[] = [];
  for (const block of blocks) {
    const data = block
      .split('\n')
      .filter((line) => line.startsWith('data:'))
      .map((line) => line.slice(5).trimStart())
      .join('\n');
    if (!data) continue;
    try {
      const parsed = aiStreamEventSchema.safeParse(JSON.parse(data));
      if (parsed.success) events.push(parsed.data);
    } catch {
      // Not JSON: ignore this event.
    }
  }
  return { events, rest };
}

/**
 * `POST /api/ai/messages`. A POST with a body, so it is read with fetch and a stream reader
 * rather than EventSource. Errors before the stream starts use the normal error envelope.
 */
export async function askAi(
  body: AskAiRequest,
  onEvent: (event: AiStreamEvent) => void,
  signal?: AbortSignal,
): Promise<void> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE}/ai/messages`, {
      method: 'POST',
      signal,
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
      body: JSON.stringify(body),
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    throw new ApiError(0, 'network_error', 'Could not reach the server. Check your connection.');
  }
  if (!response.ok) throw await toApiError(response);
  if (!response.body) throw new ApiError(response.status, 'invalid_response', 'No answer stream.');

  const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = '';
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    const { events, rest } = parseSseBuffer(buffer + value);
    buffer = rest;
    events.forEach(onEvent);
  }
  parseSseBuffer(`${buffer}\n\n`).events.forEach(onEvent);
}
