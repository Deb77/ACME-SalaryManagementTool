import type Anthropic from '@anthropic-ai/sdk';
import {
  draftSalaryChangeArgsSchema,
  findEmployeeCodesArgsSchema,
  runSqlArgsSchema,
  type AiConversation,
  type AiStep,
  type AiStreamEvent,
  type AiTurn,
  type AskAiRequest,
  type ListAiSqlRunsQuery,
  type SalaryChangeDraft,
} from '@acme/shared';
import type { Actor } from '../../auth/actor.js';
import type { AiSettings } from '../../config.js';
import type { ScopedDb } from '../../db/scope.js';
import type { Clock } from '../../lib/clock.js';
import { AppError, notFound } from '../../lib/errors.js';
import type { Logger } from '../../lib/http.js';
import type { AiMetrics } from './ai.metrics.js';
import { SYSTEM_PROMPT, contextBlock, toolsFor } from './ai.prompt.js';
import type { AiDraftRow, AiMessageRow, AiRepository } from './ai.repository.js';
import { LlmCallError, type LlmClient, type LlmRequest, type LlmResponse } from './llm.js';
import type { SqlRunner } from './sql-runner.js';

/** Where the service sends stream events; the route turns them into SSE. */
export interface AiEventSink {
  send(event: AiStreamEvent): void;
  /** True once bytes have gone out; before that, errors still use the JSON envelope. */
  readonly started: boolean;
}

const DRAFT_LIFETIME_MS = 7 * 24 * 60 * 60 * 1000;

const budgetError = (scope: 'conversation' | 'day') =>
  new AppError(
    'ai_budget_exceeded',
    scope === 'conversation'
      ? 'This conversation has reached its length limit. Start a new conversation.'
      : "You have used today's Ask AI allowance. Try again tomorrow.",
    [{ path: 'budget', message: scope }],
  );

const unavailable = () =>
  new AppError('ai_unavailable', 'Ask AI is unavailable right now. Try again in a minute.');

interface ToolOutcome {
  result: Anthropic.ToolResultBlockParam;
}

interface TurnState {
  conversationId: string;
  model: string;
  fallbackUsed: boolean;
  textStreamed: boolean;
  firstTokenMs: number | null;
  toolRounds: number;
  outputUsed: number;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  conversationTokens: number;
  started: number;
}

function toParam(row: Pick<AiMessageRow, 'role' | 'content'>): Anthropic.MessageParam {
  return {
    role: row.role === 'assistant' ? 'assistant' : 'user',
    content: row.content as Anthropic.ContentBlockParam[],
  };
}

/**
 * A turn cut off after a step (the reader left, the server restarted) is stored ending in tool
 * results with no answer. Sent as is, the next question reads like a follow-up to those results
 * and the model answers the old question instead. Every question that follows an unfinished
 * turn says so, so the model answers the question it is given.
 */
/** Output tokens another step needs to be worth a call. */
const MIN_STEP_TOKENS = 256;

/** Added to an answer that reached its length limit, so it never ends as if complete. */
export const CUT_OFF_NOTE =
  '\n\n(The answer was cut off at its length limit. Ask for fewer rows or a narrower question.)';

export const INTERRUPTED_NOTE =
  '(The previous answer was cut off before it finished and the user did not see it. ' +
  'Answer only the question below; do not continue the previous answer.)';

export function historyToMessages(
  history: readonly AiMessageRow[],
  question: Anthropic.ContentBlockParam[],
): Anthropic.MessageParam[] {
  const rows = [
    ...history,
    { role: 'user', content: question } as Pick<AiMessageRow, 'role' | 'content'>,
  ];
  return rows.map((row, index) => {
    const message = toParam(row);
    if (row.role === 'user' && rows[index - 1]?.role === 'tool') {
      return {
        role: 'user',
        content: [
          { type: 'text', text: INTERRUPTED_NOTE },
          ...(message.content as Anthropic.ContentBlockParam[]),
        ],
      };
    }
    return message;
  });
}

function textOf(content: unknown): string {
  if (!Array.isArray(content)) return '';
  return content
    .filter((block): block is { type: 'text'; text: string } => block?.type === 'text')
    .map((block) => block.text)
    .join('');
}

function parseJson(value: unknown): Record<string, unknown> | undefined {
  if (typeof value !== 'string') return undefined;
  try {
    const parsed: unknown = JSON.parse(value);
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : undefined;
  } catch {
    return undefined;
  }
}

function summaryFor(tool: string, input: Record<string, unknown>): string {
  if (tool === 'run_sql' && typeof input.purpose === 'string') return input.purpose;
  if (tool === 'find_employee_codes') return 'Looked up employee codes for a name';
  if (tool === 'draft_salary_change' && typeof input.employeeCode === 'string') {
    return `Drafted a salary change for ${input.employeeCode}`;
  }
  return tool;
}

function toDraft(row: AiDraftRow, code: string, name: string): SalaryChangeDraft {
  return {
    draftId: row.id,
    employeeId: row.employeeId,
    employeeCode: code,
    employeeName: name,
    currentAmount: { amountMinor: row.currentAmountMinor, currency: row.currency },
    proposedAmount: { amountMinor: row.proposedAmountMinor, currency: row.currency },
    effectiveDate: row.effectiveDate,
    reason: row.reason,
    note: row.note,
  };
}

/**
 * Ask AI's agent loop (docs/api.md, Ask AI; decisions #36-#42): budgets, the model call with one
 * fallback, the tools, persistence, the run_sql audit log, metrics and one log line per turn.
 * The client never sends history or tool results; the server keeps the conversation.
 */
export class AskAiService {
  constructor(
    private readonly scoped: ScopedDb,
    private readonly repo: AiRepository,
    private readonly llm: LlmClient | null,
    private readonly runner: SqlRunner,
    private readonly metrics: AiMetrics,
    private readonly clock: Clock,
    private readonly logger: Logger,
    private readonly settings: AiSettings,
  ) {}

  get configured(): boolean {
    return this.llm !== null;
  }

  async ask(
    actor: Actor,
    request: AskAiRequest,
    sink: AiEventSink,
    signal: AbortSignal,
  ): Promise<void> {
    const llm = this.llm;
    if (!llm || !this.runner.available) {
      this.metrics.increment('ai_errors_total{code="ai_unavailable"}');
      throw new AppError(
        'ai_unavailable',
        'Ask AI is not set up on this server. Everything else works as usual.',
      );
    }
    const canDraft = actor.permissions.has('salary:change');
    const prep = await this.prepare(actor, request).catch((error: unknown) => {
      if (error instanceof AppError && error.code === 'ai_budget_exceeded') {
        this.metrics.increment(`ai_budget_exceeded_total{scope="${error.details?.[0]?.message}"}`);
      }
      throw error;
    });

    const state: TurnState = {
      conversationId: prep.conversationId,
      model: this.settings.modelPrimary,
      fallbackUsed: false,
      textStreamed: false,
      firstTokenMs: null,
      toolRounds: 0,
      outputUsed: 0,
      inputTokens: 0,
      outputTokens: 0,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
      conversationTokens: prep.conversationTokens,
      started: performance.now(),
    };
    const system: Anthropic.TextBlockParam[] = [
      { type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } },
      {
        type: 'text',
        text: contextBlock({
          today: this.clock.today(),
          countries: actor.countries,
          allCountries: actor.role.countryScope === 'all',
          canDraft,
        }),
      },
    ];
    const tools = toolsFor(canDraft);
    const messages = historyToMessages(prep.history, prep.userContent);
    let seq = prep.nextSeq;

    sink.send({ type: 'conversation', conversationId: prep.conversationId });
    let errorCode: string | undefined;
    try {
      // Every call may use what is left of the output budget, so an answer is never cut at a
      // smaller step allowance. Steps stop once they have used all but the answer reserve, and
      // the final, tool-free call always gets at least the reserve (so a turn's worst case is
      // the budget plus the reserve).
      let answerNow = false;
      let answered = false;
      for (;;) {
        if (state.conversationTokens >= this.settings.conversationTokenBudget) {
          this.metrics.increment('ai_budget_exceeded_total{scope="conversation"}');
          throw budgetError('conversation');
        }
        const reserve = this.settings.answerReserveTokens;
        const remaining = this.settings.maxOutputTokens - state.outputUsed;
        const lastRound =
          answerNow ||
          state.toolRounds >= this.settings.maxToolRounds ||
          remaining - reserve < MIN_STEP_TOKENS;
        const response = await this.callModel(
          llm,
          {
            model: state.model,
            system,
            tools,
            messages,
            maxTokens: lastRound ? Math.max(remaining, reserve) : remaining,
            ...(lastRound ? { toolChoice: { type: 'none' }, effort: 'low' as const } : {}),
          },
          state,
          sink,
          signal,
        );
        const toolUses = response.content.filter(
          (block): block is Anthropic.ToolUseBlockParam => block.type === 'tool_use',
        );
        const assistantSeq = seq;
        if (toolUses.length === 0 && !lastRound && textOf(response.content).trim() === '') {
          // It chose to answer but spent its tokens thinking: answer again, tool-free and at
          // low effort. The thinking-only reply is not kept (history needs text or a tool call).
          answerNow = true;
          continue;
        }
        if (toolUses.length === 0) {
          const content = [...response.content];
          answered = textOf(content).trim() !== '';
          if (answered && response.stopReason === 'max_tokens') {
            // Cut off at the limit: say so rather than end mid-sentence as if it were complete.
            this.metrics.increment('ai_answers_cut_total');
            sink.send({ type: 'text', delta: CUT_OFF_NOTE });
            content.push({ type: 'text', text: CUT_OFF_NOTE });
          }
          await this.persist(actor, state.conversationId, [
            { seq: assistantSeq, role: 'assistant', content, response },
          ]);
          seq += 1;
          break;
        }
        // Tool calls that arrived whole run; one cut off by the token limit (always the last)
        // or past the step limit is answered with an error, so history stays valid.
        const cut = response.stopReason === 'max_tokens';
        const runnable = lastRound ? [] : cut ? toolUses.slice(0, -1) : toolUses;
        const stopped = cut
          ? 'Stopped: out of room for more steps. Answer with what you have.'
          : 'Stopped: step limit reached. Answer with what you have.';
        if (runnable.length > 0) state.toolRounds += 1;
        const ran = await this.runTools(
          actor,
          canDraft,
          state,
          assistantSeq,
          runnable,
          sink,
          signal,
        );
        const outcomes = [
          ...ran,
          ...toolUses.slice(runnable.length).map((use) => this.errorOutcome(use.id, stopped)),
        ];
        const results = outcomes.map((outcome) => outcome.result);
        await this.persist(actor, state.conversationId, [
          { seq: assistantSeq, role: 'assistant', content: response.content, response },
          { seq: assistantSeq + 1, role: 'tool', content: results },
        ]);
        seq += 2;
        messages.push({ role: 'assistant', content: response.content });
        messages.push({ role: 'user', content: results });
        // Out of room or past the step limit: one more call, without tools, to answer.
        if (cut || runnable.length < toolUses.length) {
          if (lastRound) break;
          answerNow = true;
        }
      }
      if (!answered) {
        // Never end with "done" and nothing to read.
        this.metrics.increment('ai_answers_empty_total');
        throw new AppError(
          'ai_no_answer',
          'Ask AI could not finish an answer to this. Try a narrower question, or ask for fewer rows.',
        );
      }
      sink.send({ type: 'done' });
    } catch (error) {
      if (signal.aborted) {
        // The reader closed the page or lost the connection: nothing to report or answer.
        errorCode = 'cancelled';
        this.logger.info('ai.turn_cancelled', {
          conversationId: state.conversationId,
          userId: actor.userId,
        });
        return;
      }
      errorCode = error instanceof AppError ? error.code : 'internal_error';
      if (!(error instanceof AppError)) {
        this.logger.error('ai.turn_failed', {
          conversationId: state.conversationId,
          userId: actor.userId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
      if (!sink.started) throw error;
      sink.send({
        type: 'error',
        code: errorCode,
        message: error instanceof AppError ? error.message : 'Something went wrong. Try again.',
      });
    } finally {
      this.finishTurn(actor, state, errorCode);
    }
  }

  private async prepare(actor: Actor, request: AskAiRequest) {
    return this.scoped.run(actor, async (tx) => {
      const dayStart = new Date(`${this.clock.today()}T00:00:00.000Z`);
      const today = await this.repo.tokensSince(tx, actor.userId, dayStart);
      if (today >= this.settings.dailyTokenBudget) throw budgetError('day');

      let conversationId = request.conversationId;
      let history: AiMessageRow[] = [];
      let conversationTokens = 0;
      if (conversationId) {
        const conversation = await this.repo.getConversation(tx, conversationId);
        if (!conversation) throw notFound('Conversation not found');
        conversationTokens = await this.repo.conversationTokens(tx, conversationId);
        if (conversationTokens >= this.settings.conversationTokenBudget) {
          throw budgetError('conversation');
        }
        history = await this.repo.listMessages(tx, conversationId);
      } else {
        conversationId = await this.repo.createConversation(tx, actor.userId, this.clock.now());
      }
      const seq = history.length > 0 ? history.at(-1)!.seq + 1 : 0;
      const userContent: Anthropic.ContentBlockParam[] = [{ type: 'text', text: request.message }];
      await this.repo.appendMessage(tx, {
        conversationId,
        seq,
        role: 'user',
        content: userContent,
        createdAt: this.clock.now(),
      });
      await this.repo.touchConversation(tx, conversationId, this.clock.now());
      return { conversationId, history, conversationTokens, userContent, nextSeq: seq + 1 };
    });
  }

  /** One model call; retried once on the fallback model only while no text has streamed. */
  private async callModel(
    llm: LlmClient,
    request: LlmRequest,
    state: TurnState,
    sink: AiEventSink,
    signal: AbortSignal,
  ): Promise<LlmResponse> {
    const attempt = (model: string) =>
      llm.stream(
        { ...request, model },
        {
          signal,
          timeoutMs: this.settings.callTimeoutMs,
          onText: (delta) => {
            if (state.firstTokenMs === null) {
              state.firstTokenMs = Math.round(performance.now() - state.started);
            }
            state.textStreamed = true;
            sink.send({ type: 'text', delta });
          },
        },
      );
    let response: LlmResponse;
    try {
      response = await attempt(state.model);
    } catch (error) {
      if (signal.aborted) throw error;
      const reason = error instanceof LlmCallError ? error.code : 'api_error';
      this.metrics.increment(`ai_model_failures_total{reason="${reason}"}`);
      if (state.textStreamed || state.fallbackUsed) throw unavailable();
      this.logger.info('ai.fallback', {
        conversationId: state.conversationId,
        from: state.model,
        to: this.settings.modelFallback,
        reason,
      });
      state.fallbackUsed = true;
      state.model = this.settings.modelFallback;
      try {
        response = await attempt(state.model);
      } catch (second) {
        if (signal.aborted) throw second;
        const secondReason = second instanceof LlmCallError ? second.code : 'api_error';
        this.metrics.increment(`ai_model_failures_total{reason="${secondReason}"}`);
        throw unavailable();
      }
    }
    const { usage } = response;
    state.outputUsed += usage.outputTokens;
    state.inputTokens += usage.inputTokens;
    state.outputTokens += usage.outputTokens;
    state.cacheReadTokens += usage.cacheReadTokens;
    state.cacheWriteTokens += usage.cacheWriteTokens;
    state.conversationTokens +=
      usage.inputTokens + usage.cacheReadTokens + usage.cacheWriteTokens + usage.outputTokens;
    return response;
  }

  private async persist(
    actor: Actor,
    conversationId: string,
    rows: {
      seq: number;
      role: 'assistant' | 'tool';
      content: unknown;
      response?: LlmResponse;
    }[],
  ) {
    await this.scoped.run(actor, async (tx) => {
      for (const row of rows) {
        const usage = row.response?.usage;
        await this.repo.appendMessage(tx, {
          conversationId,
          seq: row.seq,
          role: row.role,
          content: row.content,
          inputTokens: usage
            ? usage.inputTokens + usage.cacheReadTokens + usage.cacheWriteTokens
            : null,
          outputTokens: usage ? usage.outputTokens : null,
          model: row.response?.model ?? null,
          createdAt: this.clock.now(),
        });
      }
      await this.repo.touchConversation(tx, conversationId, this.clock.now());
    });
  }

  private errorOutcome(id: string, message: string): ToolOutcome {
    return { result: { type: 'tool_result', tool_use_id: id, content: message, is_error: true } };
  }

  private async runTools(
    actor: Actor,
    canDraft: boolean,
    state: TurnState,
    assistantSeq: number,
    uses: Anthropic.ToolUseBlockParam[],
    sink: AiEventSink,
    signal: AbortSignal,
  ): Promise<ToolOutcome[]> {
    const outcomes: ToolOutcome[] = [];
    for (const use of uses) {
      if (signal.aborted) {
        outcomes.push(this.errorOutcome(use.id, 'Cancelled'));
        continue;
      }
      const input = (use.input ?? {}) as Record<string, unknown>;
      sink.send({
        type: 'tool_call',
        callId: use.id,
        tool: use.name,
        summary: summaryFor(use.name, input),
      });
      let outcome: ToolOutcome & { rowCount: number; error?: string };
      try {
        outcome = await this.runTool(actor, canDraft, state, assistantSeq, use, input, sink);
      } catch (error) {
        this.logger.error('ai.tool_failed', {
          conversationId: state.conversationId,
          tool: use.name,
          error: error instanceof Error ? error.message : String(error),
        });
        outcome = { ...this.errorOutcome(use.id, 'The tool failed'), rowCount: 0, error: 'failed' };
      }
      sink.send({
        type: 'tool_result',
        callId: use.id,
        rowCount: outcome.rowCount,
        ...(outcome.error ? { error: outcome.error } : {}),
      });
      outcomes.push(outcome);
    }
    return outcomes;
  }

  private async runTool(
    actor: Actor,
    canDraft: boolean,
    state: TurnState,
    assistantSeq: number,
    use: Anthropic.ToolUseBlockParam,
    input: Record<string, unknown>,
    sink: AiEventSink,
  ): Promise<ToolOutcome & { rowCount: number; error?: string }> {
    const fail = (message: string) => ({
      ...this.errorOutcome(use.id, message),
      rowCount: 0,
      error: message,
    });
    const ok = (body: unknown, rowCount: number) => ({
      result: {
        type: 'tool_result' as const,
        tool_use_id: use.id,
        content: JSON.stringify(body),
      },
      rowCount,
    });

    switch (use.name) {
      case 'run_sql': {
        const args = runSqlArgsSchema.safeParse(input);
        if (!args.success) return fail('Invalid arguments: send {sql, purpose}');
        const run = await this.runner.run(actor.countries, args.data.sql);
        await this.recordSqlRun(actor, state, assistantSeq, use.id, args.data.sql, run);
        if (run.status !== 'ok') {
          return fail(`${run.status} (${run.errorCode}): ${run.errorMessage}`);
        }
        return ok(
          {
            columns: run.columns,
            rows: run.rows,
            rowCount: run.rowCount,
            truncated: run.truncated,
          },
          run.rowCount,
        );
      }
      case 'find_employee_codes': {
        const args = findEmployeeCodesArgsSchema.safeParse(input);
        if (!args.success) return fail('Invalid arguments: send {name} with at least 2 letters');
        const matches = await this.scoped.run(actor, (tx) =>
          this.repo.findCodesByName(tx, args.data.name),
        );
        return ok({ rowCount: matches.length, matches }, matches.length);
      }
      case 'draft_salary_change': {
        if (!canDraft) return fail('Drafting salary changes is not available to this user');
        const args = draftSalaryChangeArgsSchema.safeParse(input);
        if (!args.success) {
          return fail(
            `Invalid arguments: ${args.error.issues.map((i) => `${i.path.join('.')} ${i.message}`).join('; ')}`,
          );
        }
        const draft = await this.createDraft(actor, state.conversationId, args.data);
        if ('error' in draft) return fail(draft.error);
        sink.send({ type: 'draft_salary_change', draft: draft.draft });
        return ok({ draftId: draft.draft.draftId, employeeCode: draft.draft.employeeCode }, 1);
      }
      default:
        return fail(`Unknown tool ${use.name}`);
    }
  }

  private async createDraft(
    actor: Actor,
    conversationId: string,
    args: ReturnType<typeof draftSalaryChangeArgsSchema.parse>,
  ): Promise<{ draft: SalaryChangeDraft } | { error: string }> {
    return this.scoped.run(actor, async (tx) => {
      const employee = await this.repo.employeeByCode(tx, args.employeeCode);
      if (!employee) return { error: `No employee ${args.employeeCode} in your countries` };
      if (employee.status !== 'active') return { error: 'This employee has left' };
      if (args.effectiveDate > this.clock.today()) {
        return { error: 'Future-dated changes are not supported yet' };
      }
      if (args.effectiveDate < employee.salaryEffectiveDate) {
        return { error: `The effective date must be on or after ${employee.salaryEffectiveDate}` };
      }
      if (args.proposedAmountMinor === employee.salaryAmountMinor) {
        return { error: 'The proposed salary equals the current one' };
      }
      if ((args.reason === 'correction' || args.reason === 'other') && !args.note) {
        return { error: `A note is required when the reason is ${args.reason}` };
      }
      const now = this.clock.now();
      const row = await this.repo.createDraft(tx, {
        conversationId,
        employeeId: employee.id,
        versionAtDraft: employee.version,
        currentAmountMinor: employee.salaryAmountMinor,
        proposedAmountMinor: args.proposedAmountMinor,
        currency: employee.salaryCurrency,
        effectiveDate: args.effectiveDate,
        reason: args.reason,
        note: args.note ?? null,
        createdAt: now,
        expiresAt: new Date(now.getTime() + DRAFT_LIFETIME_MS),
      });
      return {
        draft: toDraft(row, employee.employeeCode, `${employee.firstName} ${employee.lastName}`),
      };
    });
  }

  /** The run_sql audit row, in its own transaction so it survives the AI query's rollback. */
  private async recordSqlRun(
    actor: Actor,
    state: TurnState,
    messageSeq: number,
    toolCallId: string,
    sqlText: string,
    run: Awaited<ReturnType<SqlRunner['run']>>,
  ) {
    this.metrics.recordSqlRun(run.status, run.durationMs);
    this.logger.info('ai.sql_run', {
      conversationId: state.conversationId,
      userId: actor.userId,
      toolCallId,
      model: state.model,
      status: run.status,
      errorCode: run.errorCode,
      rowCount: run.rowCount,
      truncated: run.truncated,
      durationMs: run.durationMs,
      sqlLength: sqlText.length,
    });
    try {
      await this.scoped.run(actor, (tx) =>
        this.repo.insertSqlRun(tx, {
          conversationId: state.conversationId,
          userId: actor.userId,
          messageSeq,
          toolCallId,
          sqlText: sqlText.slice(0, 20_000),
          countries: [...actor.countries],
          status: run.status,
          errorCode: run.errorCode,
          errorMessage: run.errorMessage?.slice(0, 500) ?? null,
          rowCount: run.status === 'ok' ? run.rowCount : null,
          truncated: run.truncated,
          durationMs: run.durationMs,
          model: state.model,
          createdAt: this.clock.now(),
        }),
      );
    } catch (error) {
      this.metrics.increment('ai_sql_audit_failures_total');
      this.logger.error('ai.sql_run_audit_failed', {
        conversationId: state.conversationId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private finishTurn(actor: Actor, state: TurnState, errorCode: string | undefined) {
    const totalMs = Math.round(performance.now() - state.started);
    this.metrics.recordTurn({
      ok: !errorCode,
      errorCode,
      fallbackUsed: state.fallbackUsed,
      toolRounds: state.toolRounds,
      inputTokens: state.inputTokens,
      outputTokens: state.outputTokens,
      cacheReadTokens: state.cacheReadTokens,
      cacheWriteTokens: state.cacheWriteTokens,
      firstTokenMs: state.firstTokenMs,
      totalMs,
    });
    // Span-like fields (OpenTelemetry naming) so the line maps onto a trace if one is added.
    this.logger.info('ai.turn', {
      'span.name': 'ai.turn',
      conversationId: state.conversationId,
      userId: actor.userId,
      'gen_ai.request.model': this.settings.modelPrimary,
      'gen_ai.response.model': state.model,
      fallbackUsed: state.fallbackUsed,
      toolRounds: state.toolRounds,
      'gen_ai.usage.input_tokens': state.inputTokens,
      'gen_ai.usage.output_tokens': state.outputTokens,
      cacheReadTokens: state.cacheReadTokens,
      cacheWriteTokens: state.cacheWriteTokens,
      firstTokenMs: state.firstTokenMs,
      durationMs: totalMs,
      status: errorCode ? 'error' : 'ok',
      errorCode: errorCode ?? null,
    });
  }

  /** `GET /api/ai/conversations/:id`: the user's own conversation, rebuilt from its messages. */
  async conversation(actor: Actor, id: string): Promise<AiConversation> {
    return this.scoped.run(actor, async (tx) => {
      const conversation = await this.repo.getConversation(tx, id);
      if (!conversation) throw notFound('Conversation not found');
      const messages = await this.repo.listMessages(tx, id);
      const tokensUsed = await this.repo.conversationTokens(tx, id);

      const turns: (AiTurn & { draftIds: string[] })[] = [];
      const stepsById = new Map<string, AiStep>();
      for (const message of messages) {
        const blocks = Array.isArray(message.content)
          ? (message.content as Record<string, unknown>[])
          : [];
        if (message.role === 'user') {
          turns.push({
            question: textOf(blocks),
            answer: '',
            steps: [],
            drafts: [],
            draftIds: [],
          });
          continue;
        }
        const turn = turns.at(-1);
        if (!turn) continue;
        if (message.role === 'assistant') {
          // Text written before a step is a working note, not part of the answer.
          if (!blocks.some((block) => block.type === 'tool_use')) turn.answer += textOf(blocks);
          for (const block of blocks) {
            if (block.type !== 'tool_use') continue;
            const input = (block.input ?? {}) as Record<string, unknown>;
            const tool = String(block.name);
            const step: AiStep = {
              callId: String(block.id),
              tool,
              summary: summaryFor(tool, input),
              rowCount: null,
            };
            stepsById.set(step.callId, step);
            turn.steps.push(step);
          }
        } else {
          for (const block of blocks) {
            const step = stepsById.get(String(block.tool_use_id));
            if (!step) continue;
            if (block.is_error) {
              step.rowCount = 0;
              step.error = typeof block.content === 'string' ? block.content : 'error';
              continue;
            }
            const body = parseJson(block.content);
            step.rowCount = typeof body?.rowCount === 'number' ? body.rowCount : 0;
            if (typeof body?.draftId === 'string') turn.draftIds.push(body.draftId);
          }
        }
      }
      const drafts = await this.repo.draftsByIds(
        tx,
        turns.flatMap((turn) => turn.draftIds),
      );
      const byId = new Map(
        drafts.map((d) => [
          d.draft.id,
          toDraft(d.draft, d.employeeCode, `${d.firstName} ${d.lastName}`),
        ]),
      );
      return {
        id: conversation.id,
        createdAt: conversation.createdAt.toISOString(),
        updatedAt: conversation.updatedAt.toISOString(),
        tokensUsed,
        tokenBudget: this.settings.conversationTokenBudget,
        turns: turns.map(({ draftIds, ...turn }) => ({
          ...turn,
          drafts: draftIds.flatMap((draftId) => byId.get(draftId) ?? []),
        })),
      };
    });
  }

  listSqlRuns(actor: Actor, query: ListAiSqlRunsQuery) {
    return this.scoped.run(actor, (tx) => this.repo.listSqlRuns(tx, query));
  }

  /** For the health endpoint: no secrets, just whether each piece is there. */
  async health() {
    return { configured: this.configured, database: await this.runner.ping() };
  }
}
