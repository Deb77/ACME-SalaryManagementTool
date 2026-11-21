import type Anthropic from '@anthropic-ai/sdk';
import {
  LlmCallError,
  type LlmCallOptions,
  type LlmClient,
  type LlmRequest,
  type LlmResponse,
  type LlmUsage,
} from '../modules/ai/llm.js';

/** What the scripted model does on one call. */
export interface FakeStep {
  /** Streamed as text deltas, in a few chunks. */
  text?: string;
  tools?: { name: string; input: Record<string, unknown> }[];
  usage?: Partial<LlmUsage>;
  /** Fail this call (before any text, unless `failAfterText`). */
  fail?: LlmCallError['code'];
  failAfterText?: boolean;
  stopReason?: string;
}

export type FakeScript = (request: LlmRequest, call: number) => FakeStep;

/** The last tool results the model was given, parsed from the final user message. */
export function lastToolResults(request: LlmRequest): { content: string; isError: boolean }[] {
  const last = request.messages.at(-1);
  if (!last || !Array.isArray(last.content)) return [];
  return (last.content as { type: string }[])
    .filter((block): block is Anthropic.ToolResultBlockParam => block.type === 'tool_result')
    .map((block) => ({
      content: typeof block.content === 'string' ? block.content : JSON.stringify(block.content),
      isError: block.is_error === true,
    }));
}

/** The user's latest question in a request. */
export function lastQuestion(request: LlmRequest): string {
  for (const message of [...request.messages].reverse()) {
    if (message.role !== 'user' || !Array.isArray(message.content)) continue;
    const text = message.content.find((block) => block.type === 'text');
    if (text && text.type === 'text') return text.text;
  }
  return '';
}

/**
 * A scripted stand-in for the model, so the agent loop, tools, budgets and fallback run in tests
 * and in the CI eval suite without an API key. It records every request it receives.
 */
export class FakeLlmClient implements LlmClient {
  readonly requests: LlmRequest[] = [];
  private calls = 0;

  constructor(private script: FakeScript) {}

  setScript(script: FakeScript) {
    this.script = script;
    this.calls = 0;
  }

  async stream(request: LlmRequest, options: LlmCallOptions): Promise<LlmResponse> {
    this.requests.push(structuredClone(request));
    const step = this.script(request, this.calls++);
    if (step.fail && !step.failAfterText) throw new LlmCallError(step.fail, `fake ${step.fail}`);
    const content: Anthropic.ContentBlockParam[] = [];
    if (step.text) {
      for (const chunk of step.text.match(/.{1,40}/gs) ?? []) {
        if (options.signal.aborted) throw new LlmCallError('aborted', 'aborted');
        options.onText(chunk);
      }
      content.push({ type: 'text', text: step.text });
    }
    if (step.fail) throw new LlmCallError(step.fail, `fake ${step.fail} after text`);
    (step.tools ?? []).forEach((tool, index) =>
      content.push({
        type: 'tool_use',
        id: `toolu_${this.calls}_${index}`,
        name: tool.name,
        input: tool.input,
      }),
    );
    return {
      content,
      stopReason: step.stopReason ?? (step.tools?.length ? 'tool_use' : 'end_turn'),
      model: request.model,
      usage: {
        inputTokens: 100,
        outputTokens: 20,
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
        ...step.usage,
      },
    };
  }
}
