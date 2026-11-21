import { sql } from 'drizzle-orm';
import {
  bigint,
  char,
  check,
  date,
  foreignKey,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';
import { users } from './access.js';
import { countries, departments, jobTitles } from './catalogue.js';
import { bytea } from './types.js';

/**
 * Employees and the imports that create or change them (docs/database.md, Tables). Only the
 * indexes needed at 10,000 rows are here; the 100x ones (E2-E4, E6, E7, R2) come later.
 * Row-level security on these tables arrives with the grants migration.
 */

export const employeeStatuses = ['active', 'terminated'] as const;
export const terminationReasons = [
  'resignation',
  'dismissal',
  'redundancy',
  'retirement',
  'end_of_contract',
  'other',
] as const;

export const imports = pgTable(
  'imports',
  {
    id: uuid().primaryKey().defaultRandom(),
    createdBy: uuid()
      .notNull()
      .references(() => users.id),
    status: text({ enum: ['uploaded', 'validated', 'committed', 'undone', 'failed'] })
      .notNull()
      .default('uploaded'),
    fileName: text().notNull(),
    fileFormat: text({ enum: ['xlsx', 'csv'] }).notNull(),
    fileSizeBytes: integer().notNull(),
    fileSha256: bytea().notNull(),
    columns: jsonb().notNull(),
    mapping: jsonb(),
    defaults: jsonb(),
    summary: jsonb(),
    /** Countries the valid rows touch; used by the proposed RLS policy. */
    countryCodes: char({ length: 2 })
      .array()
      .notNull()
      .default(sql`'{}'`),
    failureMessage: text(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    validatedAt: timestamp({ withTimezone: true }),
    committedAt: timestamp({ withTimezone: true }),
    undoneAt: timestamp({ withTimezone: true }),
  },
  (t) => [
    check(
      'imports_status',
      sql`${t.status} in ('uploaded', 'validated', 'committed', 'undone', 'failed')`,
    ),
    check('imports_file_format', sql`${t.fileFormat} in ('xlsx', 'csv')`),
    check('imports_file_size', sql`${t.fileSizeBytes} between 1 and 5242880`),
  ],
);

export const employees = pgTable(
  'employees',
  {
    id: uuid().primaryKey().defaultRandom(),
    employeeCode: text().notNull().unique(), // U1
    firstName: text().notNull(),
    lastName: text().notNull(),
    /** Lower-case text, not citext: citext comparison is not leakproof under RLS. */
    email: text().notNull().unique(), // U2
    countryCode: char({ length: 2 })
      .notNull()
      .references(() => countries.code),
    jobTitleId: text()
      .notNull()
      .references(() => jobTitles.id),
    departmentId: text()
      .notNull()
      .references(() => departments.id),
    hireDate: date({ mode: 'string' }).notNull(),
    status: text({ enum: employeeStatuses }).notNull().default('active'),
    terminationDate: date({ mode: 'string' }),
    terminationReason: text({ enum: terminationReasons }),
    terminationNote: text(),
    /** Current annual base salary in minor units; duplicates the latest history row. */
    salaryAmountMinor: bigint({ mode: 'number' }).notNull(),
    salaryCurrency: char({ length: 3 }).notNull(),
    salaryEffectiveDate: date({ mode: 'string' }).notNull(),
    /** Set when an import created the employee; undo deletes only these. */
    createdByImportId: uuid().references(() => imports.id),
    version: integer().notNull().default(1),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // The pay currency is always the country's currency.
    foreignKey({
      name: 'employees_country_currency_fk',
      columns: [t.countryCode, t.salaryCurrency],
      foreignColumns: [countries.code, countries.currency],
    }),
    // E8: target of the composite foreign key from salary_changes.
    unique('employees_id_country').on(t.id, t.countryCode),
    // E1: insights, the RLS country predicate and the directory's country filter.
    index('employees_active_country_title_salary')
      .on(t.countryCode, t.jobTitleId, t.salaryAmountMinor)
      .where(sql`${t.status} = 'active'`),
    // E5: import undo.
    index('employees_created_by_import')
      .on(t.createdByImportId)
      .where(sql`${t.createdByImportId} is not null`),
    check('employees_code_format', sql`${t.employeeCode} ~ '^[A-Z0-9-]{3,20}$'`),
    check('employees_first_name_length', sql`char_length(${t.firstName}) between 1 and 100`),
    check('employees_last_name_length', sql`char_length(${t.lastName}) between 1 and 100`),
    check('employees_email_lower', sql`${t.email} = lower(${t.email})`),
    check('employees_status', sql`${t.status} in ('active', 'terminated')`),
    check(
      'employees_termination_reason',
      sql`${t.terminationReason} in ('resignation', 'dismissal', 'redundancy', 'retirement', 'end_of_contract', 'other')`,
    ),
    check('employees_termination_note_length', sql`char_length(${t.terminationNote}) <= 500`),
    check('employees_salary_positive', sql`${t.salaryAmountMinor} > 0`),
    check('employees_version', sql`${t.version} >= 1`),
    check(
      'employees_terminated_fields',
      sql`(${t.status} = 'terminated') = (${t.terminationDate} is not null and ${t.terminationReason} is not null)`,
    ),
    check(
      'employees_note_only_when_terminated',
      sql`${t.status} = 'terminated' or ${t.terminationNote} is null`,
    ),
    check(
      'employees_termination_after_hire',
      sql`${t.terminationDate} is null or ${t.terminationDate} >= ${t.hireDate}`,
    ),
  ],
);

export const importRows = pgTable(
  'import_rows',
  {
    importId: uuid()
      .notNull()
      .references(() => imports.id, { onDelete: 'cascade' }),
    /** Spreadsheet row number, as HR sees it in Excel. */
    rowNumber: integer().notNull(),
    raw: jsonb().notNull(),
    outcome: text({ enum: ['create', 'update', 'unchanged', 'error'] }),
    employeeCode: text(),
    employeeId: uuid().references(() => employees.id, { onDelete: 'set null' }),
    countryCode: char({ length: 2 }),
    changes: jsonb(),
    errors: jsonb(),
  },
  (t) => [
    primaryKey({ columns: [t.importId, t.rowNumber] }),
    // R1: paged review by outcome.
    index('import_rows_outcome').on(t.importId, t.outcome, t.rowNumber),
    check('import_rows_row_number', sql`${t.rowNumber} >= 1`),
    check('import_rows_outcome', sql`${t.outcome} in ('create', 'update', 'unchanged', 'error')`),
    check('import_rows_error_detail', sql`${t.outcome} <> 'error' or ${t.errors} is not null`),
  ],
);
