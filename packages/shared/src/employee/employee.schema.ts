import { z } from 'zod';
import {
  catalogueIdSchema,
  catalogueRefSchema,
  countryCodeSchema,
  isoDateSchema,
  timestampSchema,
  versionSchema,
} from '../core/common.schema.js';
import { moneySchema, salaryAmountMinorSchema } from '../core/money.schema.js';
import { listParamSchema, pageQuerySchema, sortSchema } from '../core/pagination.schema.js';

export const employeeCodeSchema = z
  .string()
  .regex(/^[A-Z0-9-]{3,20}$/, 'Expected an employee code such as "ACM-000123"');

const nameSchema = z.string().trim().min(1).max(100);

export const employeeStatuses = ['active', 'terminated'] as const;

export const terminationReasons = [
  'resignation',
  'dismissal',
  'redundancy',
  'retirement',
  'end_of_contract',
  'other',
] as const;

export const employeeSchema = z.object({
  id: z.uuid(),
  employeeCode: employeeCodeSchema,
  firstName: z.string(),
  lastName: z.string(),
  email: z.email(),
  country: countryCodeSchema,
  jobTitle: catalogueRefSchema,
  department: catalogueRefSchema,
  hireDate: isoDateSchema,
  status: z.enum(employeeStatuses),
  termination: z
    .object({
      date: isoDateSchema,
      reason: z.enum(terminationReasons),
      note: z.string().nullable(),
    })
    .nullable(),
  /** Current annual base salary, in the currency of `country`. */
  salary: moneySchema,
  salaryEffectiveDate: isoDateSchema,
  version: versionSchema,
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
});

export type Employee = z.infer<typeof employeeSchema>;

/**
 * New joiner. The client sends only the amount: the currency is derived from `country`
 * on the server, so a mismatched currency cannot be submitted (unknown keys are rejected).
 */
export const createEmployeeRequestSchema = z.strictObject({
  employeeCode: employeeCodeSchema.optional(),
  firstName: nameSchema,
  lastName: nameSchema,
  email: z.email(),
  country: countryCodeSchema,
  jobTitleId: catalogueIdSchema,
  departmentId: catalogueIdSchema,
  hireDate: isoDateSchema,
  salaryAmountMinor: salaryAmountMinorSchema,
});

export type CreateEmployeeRequest = z.infer<typeof createEmployeeRequestSchema>;

/**
 * Edit details. Salary, country and status are deliberately not editable here: pay goes
 * through salary changes, leaving goes through terminate, and a country move would change
 * the currency.
 */
export const updateEmployeeRequestSchema = z
  .strictObject({
    firstName: nameSchema.optional(),
    lastName: nameSchema.optional(),
    email: z.email().optional(),
    jobTitleId: catalogueIdSchema.optional(),
    departmentId: catalogueIdSchema.optional(),
    hireDate: isoDateSchema.optional(),
    version: versionSchema,
  })
  .refine((body) => Object.keys(body).some((key) => key !== 'version'), {
    message: 'Provide at least one field to change',
  });

export type UpdateEmployeeRequest = z.infer<typeof updateEmployeeRequestSchema>;

export const terminateEmployeeRequestSchema = z.strictObject({
  terminationDate: isoDateSchema,
  reason: z.enum(terminationReasons),
  note: z.string().trim().max(500).optional(),
  version: versionSchema,
});

export type TerminateEmployeeRequest = z.infer<typeof terminateEmployeeRequestSchema>;

export const employeeSortFields = [
  'name',
  'employeeCode',
  'country',
  'jobTitle',
  'department',
  'hireDate',
  'salary',
] as const;

/** Filters shared by the list and the CSV export, so the export is exactly what is on screen. */
const employeeFilterShape = {
  q: z
    .string()
    .trim()
    .max(100)
    .optional()
    .transform((q) => q || undefined),
  country: listParamSchema(countryCodeSchema),
  department: listParamSchema(catalogueIdSchema),
  jobTitle: listParamSchema(catalogueIdSchema),
  status: z.enum(['active', 'terminated', 'all']).default('active'),
  sort: sortSchema(employeeSortFields, 'name'),
};

type EmployeeFilter = z.infer<z.ZodObject<typeof employeeFilterShape>>;

/** Salaries are in different currencies, so ordering by salary only makes sense within one. */
function salarySortNeedsOneCountry(query: EmployeeFilter, ctx: z.RefinementCtx) {
  if (query.sort.field === 'salary' && query.country?.length !== 1) {
    ctx.addIssue({
      code: 'custom',
      path: ['sort'],
      message:
        'Sorting by salary needs exactly one country filter (salaries are in local currency)',
    });
  }
}

export const listEmployeesQuerySchema = z
  .object({ ...employeeFilterShape, ...pageQuerySchema.shape })
  .superRefine(salarySortNeedsOneCountry);

export type ListEmployeesQuery = z.infer<typeof listEmployeesQuerySchema>;

export const exportEmployeesQuerySchema = z
  .object(employeeFilterShape)
  .superRefine(salarySortNeedsOneCountry);

export type ExportEmployeesQuery = z.infer<typeof exportEmployeesQuerySchema>;
