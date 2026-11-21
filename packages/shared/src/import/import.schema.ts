import { z } from 'zod';
import { countryCodeSchema, isoDateSchema, timestampSchema } from '../core/common.schema.js';

export const importStatuses = ['uploaded', 'validated', 'committed', 'undone', 'failed'] as const;
export type ImportStatus = (typeof importStatuses)[number];

/** Fields a spreadsheet column can be matched to (`suggestedMapping` keys). */
export const importFields = [
  'employeeCode',
  'firstName',
  'lastName',
  'email',
  'country',
  'jobTitle',
  'department',
  'hireDate',
  'salaryAmount',
  'salaryEffectiveDate',
] as const;

export type ImportField = (typeof importFields)[number];

export const importOutcomes = ['create', 'update', 'unchanged', 'error'] as const;
export type ImportOutcome = (typeof importOutcomes)[number];

/** Field → column header in the uploaded file. */
export const importMappingSchema = z.partialRecord(z.enum(importFields), z.string().min(1));
export type ImportMapping = z.infer<typeof importMappingSchema>;

/** `POST /api/imports` (multipart upload) → 201. */
export const importUploadResponseSchema = z.object({
  id: z.uuid(),
  status: z.literal('uploaded'),
  fileName: z.string(),
  columns: z.array(z.string()),
  sampleRows: z.array(z.array(z.string())),
  suggestedMapping: importMappingSchema,
});

export type ImportUploadResponse = z.infer<typeof importUploadResponseSchema>;

/** `PUT /api/imports/:id/mapping`: set the mapping and run the dry run (changes nothing). */
export const importMappingRequestSchema = z.strictObject({
  mapping: importMappingSchema,
  defaults: z
    .strictObject({
      country: countryCodeSchema.optional(),
      salaryEffectiveDate: isoDateSchema.optional(),
    })
    .optional(),
});

export type ImportMappingRequest = z.infer<typeof importMappingRequestSchema>;

export const importSummarySchema = z.object({
  rows: z.int().nonnegative(),
  create: z.int().nonnegative(),
  update: z.int().nonnegative(),
  unchanged: z.int().nonnegative(),
  error: z.int().nonnegative(),
});

export type ImportSummary = z.infer<typeof importSummarySchema>;

/** `GET /api/imports/:id` and the result of the dry run, commit and undo. */
export const importSchema = z.object({
  id: z.uuid(),
  status: z.enum(importStatuses),
  fileName: z.string(),
  summary: importSummarySchema.nullable(),
  createdAt: timestampSchema,
});

export type Import = z.infer<typeof importSchema>;

const changeValue = z.union([z.string(), z.number(), z.null()]);

export const importRowSchema = z.object({
  rowNumber: z.int().positive(),
  outcome: z.enum(importOutcomes),
  employeeCode: z.string().nullable(),
  /** Who the row is about: the matched employee's name, else the name cells in the file. */
  employeeName: z.string().nullable().optional(),
  /** The row's country (the matched employee's for updates), so its salary has a currency. */
  countryCode: z.string().nullable().optional(),
  changes: z.record(z.string(), z.object({ from: changeValue, to: changeValue })),
  errors: z.array(z.object({ column: z.string(), message: z.string() })),
});

export type ImportRow = z.infer<typeof importRowSchema>;

/** `POST /api/imports/:id/commit`: `skipInvalidRows` is required when the dry run found errors. */
export const commitImportRequestSchema = z.strictObject({
  skipInvalidRows: z.boolean(),
});

export type CommitImportRequest = z.infer<typeof commitImportRequestSchema>;

/** `GET /api/imports/:id/rows` and `rows.csv`. */
export const listImportRowsQuerySchema = z.object({
  outcome: z.enum(importOutcomes).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

/** `GET /api/imports`: recent imports, newest first. */
export const importsResponseSchema = z.object({ items: z.array(importSchema) });
