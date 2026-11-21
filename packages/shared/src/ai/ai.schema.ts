import { z } from 'zod';
import { countryCodeSchema, isoDateSchema, timestampSchema } from '../core/common.schema.js';
import { moneySchema } from '../core/money.schema.js';
import { employeeCodeSchema } from '../employee/employee.schema.js';
import { salaryChangeReasons } from '../salary-change/salary-change.schema.js';

export const askAiRequestSchema = z.strictObject({
  /** Omit to start a new conversation. */
  conversationId: z.uuid().optional(),
  message: z.string().trim().min(1).max(2000),
});

export type AskAiRequest = z.infer<typeof askAiRequestSchema>;

/** A salary change the assistant proposes. It is never applied: the user opens it in the normal dialog. */
export const salaryChangeDraftSchema = z.object({
  draftId: z.uuid(),
  employeeId: z.uuid(),
  employeeCode: employeeCodeSchema,
  /** Resolved by the server for the signed-in user; the model only ever sees the code. */
  employeeName: z.string(),
  currentAmount: moneySchema,
  proposedAmount: moneySchema,
  effectiveDate: isoDateSchema,
  reason: z.enum(salaryChangeReasons),
  note: z.string().nullable(),
});

export type SalaryChangeDraft = z.infer<typeof salaryChangeDraftSchema>;

/** One Server-Sent Event in the Ask AI stream (the `data:` payload, discriminated by `type`). */
export const aiStreamEventSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('conversation'), conversationId: z.uuid() }),
  z.object({ type: z.literal('text'), delta: z.string() }),
  z.object({
    type: z.literal('tool_call'),
    callId: z.string(),
    tool: z.string(),
    /**
     * Plain-English description of the step, shown under the answer. The SQL itself never
     * reaches the browser; it is kept in the SQL audit log (`GET /api/ai/sql-runs`).
     */
    summary: z.string(),
  }),
  z.object({
    type: z.literal('tool_result'),
    callId: z.string(),
    rowCount: z.int().nonnegative(),
    /** Set when the tool failed or the SQL was rejected; the model sees the same message. */
    error: z.string().optional(),
  }),
  z.object({ type: z.literal('draft_salary_change'), draft: salaryChangeDraftSchema }),
  z.object({ type: z.literal('done') }),
  z.object({ type: z.literal('error'), code: z.string(), message: z.string() }),
]);

export type AiStreamEvent = z.infer<typeof aiStreamEventSchema>;

// ---- Tool arguments (validated server-side before any tool runs) ----

export const runSqlArgsSchema = z.strictObject({
  /** One read-only SELECT (or WITH … SELECT) over the allowed tables and columns. */
  sql: z.string().trim().min(1).max(5000),
  /** One line saying what the query answers, shown to the user next to the SQL. */
  purpose: z.string().trim().min(1).max(200),
});

export const findEmployeeCodesArgsSchema = z.strictObject({
  /** A name (or part of one) that the user typed. */
  name: z.string().trim().min(2).max(100),
});

/** Reasons a person may pick in the dialog; the system-only ones are never drafted. */
export const draftableSalaryChangeReasons = [
  'annual_review',
  'promotion',
  'market_adjustment',
  'correction',
  'other',
] as const satisfies readonly (typeof salaryChangeReasons)[number][];

export const draftSalaryChangeArgsSchema = z.strictObject({
  employeeCode: employeeCodeSchema,
  /** New annual base salary in the employee's currency, minor units. */
  proposedAmountMinor: z.int().positive().max(Number.MAX_SAFE_INTEGER),
  effectiveDate: isoDateSchema,
  reason: z.enum(draftableSalaryChangeReasons),
  note: z.string().trim().max(500).optional(),
});

export type RunSqlArgs = z.infer<typeof runSqlArgsSchema>;
export type FindEmployeeCodesArgs = z.infer<typeof findEmployeeCodesArgsSchema>;
export type DraftSalaryChangeArgs = z.infer<typeof draftSalaryChangeArgsSchema>;

// ---- GET /api/ai/conversations/:id ----

export const aiStepSchema = z.object({
  callId: z.string(),
  tool: z.string(),
  summary: z.string(),
  rowCount: z.int().nonnegative().nullable(),
  error: z.string().optional(),
});

export const aiTurnSchema = z.object({
  question: z.string(),
  answer: z.string(),
  steps: z.array(aiStepSchema),
  drafts: z.array(salaryChangeDraftSchema),
});

export const aiConversationSchema = z.object({
  id: z.uuid(),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
  /** Input plus output tokens used so far, against the per-conversation budget. */
  tokensUsed: z.int().nonnegative(),
  tokenBudget: z.int().positive(),
  turns: z.array(aiTurnSchema),
});

export type AiStep = z.infer<typeof aiStepSchema>;
export type AiTurn = z.infer<typeof aiTurnSchema>;
export type AiConversation = z.infer<typeof aiConversationSchema>;

// ---- GET /api/ai/sql-runs (the run_sql audit log) ----

export const aiSqlRunStatuses = ['ok', 'rejected', 'error', 'timeout'] as const;

export const aiSqlRunSchema = z.object({
  id: z.uuid(),
  conversationId: z.uuid(),
  user: z.object({ id: z.uuid(), name: z.string() }),
  messageSeq: z.int().nonnegative(),
  toolCallId: z.string(),
  sql: z.string(),
  countries: z.array(countryCodeSchema),
  status: z.enum(aiSqlRunStatuses),
  errorCode: z.string().nullable(),
  errorMessage: z.string().nullable(),
  rowCount: z.int().nonnegative().nullable(),
  truncated: z.boolean(),
  durationMs: z.int().nonnegative(),
  model: z.string(),
  createdAt: timestampSchema,
});

export type AiSqlRun = z.infer<typeof aiSqlRunSchema>;

/** Filters combine with AND; `to` is inclusive (whole day), as in the audit log. */
export const listAiSqlRunsQuerySchema = z.object({
  userId: z.uuid().optional(),
  status: z.enum(aiSqlRunStatuses).optional(),
  from: z.iso.date().optional(),
  to: z.iso.date().optional(),
  cursor: z.string().min(1).max(200).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export type ListAiSqlRunsQuery = z.infer<typeof listAiSqlRunsQuerySchema>;

export const aiSqlRunsResponseSchema = z.object({
  items: z.array(aiSqlRunSchema),
  nextCursor: z.string().nullable(),
});

// ---- GET /api/ai/metrics ----

export const aiHistogramSchema = z.object({
  count: z.int().nonnegative(),
  sum: z.number().nonnegative(),
  /** Upper bounds (ms) and how many observations fell at or under each. */
  buckets: z.array(z.object({ le: z.number(), count: z.int().nonnegative() })),
});

export const aiMetricsSchema = z.object({
  since: timestampSchema,
  counters: z.record(z.string(), z.number().nonnegative()),
  histograms: z.record(z.string(), aiHistogramSchema),
  /** Rates over the alert window (see AI_ALERT_* settings). */
  window: z.object({
    minutes: z.int().positive(),
    turns: z.int().nonnegative(),
    errorRate: z.number().min(0).max(1),
    fallbackRate: z.number().min(0).max(1),
  }),
  tokensToday: z.int().nonnegative(),
  alerts: z.array(z.object({ name: z.string(), message: z.string() })),
});

export type AiMetrics = z.infer<typeof aiMetricsSchema>;
