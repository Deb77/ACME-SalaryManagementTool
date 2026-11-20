import { z } from 'zod';
import { isoDateSchema } from '../core/common.schema.js';
import { moneySchema } from '../core/money.schema.js';
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
    /** Human-readable description of the query, shown under the answer ("show the queries"). */
    summary: z.string(),
    args: z.record(z.string(), z.unknown()),
  }),
  z.object({
    type: z.literal('tool_result'),
    callId: z.string(),
    rowCount: z.int().nonnegative(),
  }),
  z.object({ type: z.literal('draft_salary_change'), draft: salaryChangeDraftSchema }),
  z.object({ type: z.literal('done') }),
  z.object({ type: z.literal('error'), code: z.string(), message: z.string() }),
]);

export type AiStreamEvent = z.infer<typeof aiStreamEventSchema>;
