import { z } from 'zod';
import {
  isoDateSchema,
  timestampSchema,
  userRefSchema,
  versionSchema,
} from '../core/common.schema.js';
import { employeeSchema } from '../employee/employee.schema.js';
import { moneySchema, salaryAmountMinorSchema } from '../core/money.schema.js';

/** Reasons an HR user can pick in the salary change dialog. */
export const salaryChangeReasons = [
  'annual_review',
  'promotion',
  'market_adjustment',
  'correction',
  'other',
] as const;

/** Reasons only the system writes: the first salary, imports and import undo. */
export const systemSalaryChangeReasons = ['hire', 'import', 'import_undo'] as const;

const reasonsNeedingNote: ReadonlySet<string> = new Set(['correction', 'other']);

export const createSalaryChangeRequestSchema = z
  .strictObject({
    /** New annual base salary in the employee's currency; the server supplies the currency. */
    amountMinor: salaryAmountMinorSchema,
    effectiveDate: isoDateSchema,
    reason: z.enum(salaryChangeReasons),
    note: z.string().trim().max(500).optional(),
    /** The employee's `version` the user saw, so two HR users cannot overwrite each other. */
    version: versionSchema,
    /** Set when the user confirmed a change drafted by Ask AI; recorded in the audit log. */
    aiDraftId: z.uuid().optional(),
  })
  .superRefine((body, ctx) => {
    if (reasonsNeedingNote.has(body.reason) && !body.note) {
      ctx.addIssue({
        code: 'custom',
        path: ['note'],
        message: `A note is required when the reason is "${body.reason}"`,
      });
    }
  });

export type CreateSalaryChangeRequest = z.infer<typeof createSalaryChangeRequestSchema>;

export const salaryChangeSchema = z.object({
  id: z.uuid(),
  employeeId: z.uuid(),
  amount: moneySchema,
  /** `null` for the first entry (hire or first import). */
  previousAmount: moneySchema.nullable(),
  effectiveDate: isoDateSchema,
  reason: z.enum([...salaryChangeReasons, ...systemSalaryChangeReasons]),
  note: z.string().nullable(),
  importId: z.uuid().nullable(),
  aiDraftId: z.uuid().nullable(),
  createdAt: timestampSchema,
  createdBy: userRefSchema,
});

export type SalaryChange = z.infer<typeof salaryChangeSchema>;

/** The new history entry plus the updated employee, so the UI refreshes without a refetch. */
export const createSalaryChangeResponseSchema = z.object({
  salaryChange: salaryChangeSchema,
  employee: employeeSchema,
});

export type CreateSalaryChangeResponse = z.infer<typeof createSalaryChangeResponseSchema>;

/** `GET /api/employees/:id/salary-changes`: the full history, newest first. */
export const salaryHistoryResponseSchema = z.object({ items: z.array(salaryChangeSchema) });

export type SalaryHistoryResponse = z.infer<typeof salaryHistoryResponseSchema>;
