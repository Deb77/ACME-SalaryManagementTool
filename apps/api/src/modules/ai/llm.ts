import Anthropic from '@anthropic-ai/sdk';

/** One model call: what Ask AI sends, independent of the SDK's request shape. */
export interface LlmRequest {
  model: string;
  /** Stable blocks first (cached), then per-user context. */
  system: Anthropic.TextBlockParam[];
  tools: Anthropic.Tool[];
  messages: Anthropic.MessageParam[];
  maxTokens: number;
  /** `none` on the last allowed round, so the model answers instead of calling another tool. */
  toolChoice?: Anthropic.ToolChoice;
}

export interface LlmUsage {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
}

export interface LlmResponse {
  /** The content blocks exactly as returned, so they can be sent back unchanged next turn. */
  content: Anthropic.ContentBlockParam[];
  stopReason: string | null;
  usage: LlmUsage;
  model: string;
}

export interface LlmCallOptions {
  signal: AbortSignal;
  timeoutMs: number;
  onText: (delta: string) => void;
}

/**
 * The model behind Ask AI. The service only talks to this interface, so tests and evals inject a
 * scripted fake and nothing needs an API key to build or test.
 */
export interface LlmClient {
  stream(request: LlmRequest, options: LlmCallOptions): Promise<LlmResponse>;
}

/** Thrown when a call fails in a way the fallback model may fix (error, timeout, refusal). */
export class LlmCallError extends Error {
  constructor(
    readonly code: 'timeout' | 'refusal' | 'api_error' | 'aborted',
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = 'LlmCallError';
  }
}

/** The real client: one streamed Messages API call per request, no SDK retries (we fall back). */
export class AnthropicLlmClient implements LlmClient {
  private readonly client: Anthropic;

  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey, maxRetries: 0 });
  }

  async stream(request: LlmRequest, options: LlmCallOptions): Promise<LlmResponse> {
    const timeout = AbortSignal.timeout(options.timeoutMs);
    const signal = AbortSignal.any([options.signal, timeout]);
    try {
      const stream = this.client.messages.stream(
        {
          model: request.model,
          max_tokens: request.maxTokens,
          system: request.system,
          tools: request.tools,
          messages: request.messages,
          ...(request.toolChoice ? { tool_choice: request.toolChoice } : {}),
          // Answers are short analytic turns with a few tool calls; medium keeps them quick.
          output_config: { effort: 'medium' },
          // Caches the growing conversation prefix; the system block carries its own breakpoint.
          cache_control: { type: 'ephemeral' },
        },
        { signal, timeout: options.timeoutMs, maxRetries: 0 },
      );
      stream.on('text', (delta) => options.onText(delta));
      const message = await stream.finalMessage();
      if (message.stop_reason === 'refusal') {
        throw new LlmCallError('refusal', 'The model declined to answer');
      }
      return {
        // Response blocks are valid request blocks; they go back to the API unchanged.
        content: message.content as Anthropic.ContentBlockParam[],
        stopReason: message.stop_reason,
        model: message.model,
        usage: {
          inputTokens: message.usage.input_tokens,
          outputTokens: message.usage.output_tokens,
          cacheReadTokens: message.usage.cache_read_input_tokens ?? 0,
          cacheWriteTokens: message.usage.cache_creation_input_tokens ?? 0,
        },
      };
    } catch (error) {
      if (error instanceof LlmCallError) throw error;
      if (options.signal.aborted) throw new LlmCallError('aborted', 'The request was cancelled');
      if (timeout.aborted || error instanceof Anthropic.APIConnectionTimeoutError) {
        throw new LlmCallError('timeout', 'The model did not answer in time');
      }
      if (error instanceof Anthropic.APIError) {
        throw new LlmCallError('api_error', `Model API error ${error.status ?? ''}`, error.status);
      }
      throw new LlmCallError('api_error', 'The model call failed');
    }
  }
}
