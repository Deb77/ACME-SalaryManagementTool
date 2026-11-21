import { sql } from 'drizzle-orm';
import {
  bigint,
  char,
  check,
  date,
  foreignKey,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { users } from './access.js';
import { countries } from './catalogue.js';
import { employees, imports } from './employees.js';

export const salaryChangeReasons = [
  'annual_review',
  'promotion',
  'market_adjustment',
  'correction',
  'other',
  'hire',
  'import',
  'import_undo',
] as const;

/**
 * The append-only salary history. The employee's country is copied onto each row, kept honest
 * by a composite foreign key, so the 100x index plan (S4, decision #27) needs no backfill.
 * S4 itself uses INCLUDE, which Drizzle can't express, so it lives in a hand-written migration.
 * `ai_draft_id` is added by the Ask AI migration, with the table it points at.
 */
export const salaryChanges = pgTable(
  'salary_changes',
  {
    id: uuid().primaryKey().defaultRandom(),
    employeeId: uuid().notNull(),
    countryCode: char({ length: 2 }).notNull(),
    amountMinor: bigint({ mode: 'number' }).notNull(),
    /** Null only for the first entry. */
    previousAmountMinor: bigint({ mode: 'number' }),
    currency: char({ length: 3 }).notNull(),
    effectiveDate: date({ mode: 'string' }).notNull(),
    reason: text({ enum: salaryChangeReasons }).notNull(),
    note: text(),
    importId: uuid().references(() => imports.id),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    createdBy: uuid()
      .notNull()
      .references(() => users.id),
  },
  (t) => [
    foreignKey({
      name: 'salary_changes_employee_country_fk',
      columns: [t.employeeId, t.countryCode],
      foreignColumns: [employees.id, employees.countryCode],
    }),
    // Descending indexes say NULLS FIRST, the default for DESC, so a plain `order by … desc`
    // can read them in order.
    // S1: history newest first, the latest-entry rule, and the employee foreign key.
    index('salary_changes_employee_effective').on(
      t.employeeId,
      t.effectiveDate.desc().nullsFirst(),
      t.createdAt.desc().nullsFirst(),
    ),
    // S2: rows written by an import, for undo.
    index('salary_changes_import')
      .on(t.importId)
      .where(sql`${t.importId} is not null`),
    check('salary_changes_amount_positive', sql`${t.amountMinor} > 0`),
    check('salary_changes_previous_positive', sql`${t.previousAmountMinor} > 0`),
    check(
      'salary_changes_reason',
      sql`${t.reason} in ('annual_review', 'promotion', 'market_adjustment', 'correction', 'other', 'hire', 'import', 'import_undo')`,
    ),
    check('salary_changes_note_length', sql`char_length(${t.note}) <= 500`),
    check(
      'salary_changes_note_required',
      sql`${t.reason} not in ('correction', 'other') or ${t.note} is not null`,
    ),
    check(
      'salary_changes_import_reason',
      sql`${t.reason} not in ('import', 'import_undo') or ${t.importId} is not null`,
    ),
    check(
      'salary_changes_first_entry',
      sql`${t.previousAmountMinor} is not null or ${t.reason} in ('hire', 'import')`,
    ),
  ],
);

export const auditActions = [
  'employee.created',
  'employee.updated',
  'employee.terminated',
  'salary.changed',
  'import.committed',
  'import.undone',
  'export.created',
  'user.invited',
  'user.updated',
  'user.deactivated',
  'role.created',
  'role.updated',
  'role.deleted',
] as const;

/** Who changed what and when. Insert-only for the app role once the grants land. */
export const auditEvents = pgTable(
  'audit_events',
  {
    id: uuid().primaryKey().defaultRandom(),
    /** clock_timestamp(), so events in one transaction keep their order. */
    occurredAt: timestamp({ withTimezone: true })
      .notNull()
      .default(sql`clock_timestamp()`),
    actorId: uuid()
      .notNull()
      .references(() => users.id),
    /** Role key at the time; text, so the row survives the role being renamed or deleted. */
    actorRole: text().notNull(),
    action: text({ enum: auditActions }).notNull(),
    entityType: text({ enum: ['employee', 'import', 'export', 'user', 'role'] }).notNull(),
    entityId: uuid(),
    entityLabel: text().notNull(),
    countryCode: char({ length: 2 }).references(() => countries.code),
    before: jsonb(),
    after: jsonb(),
    importId: uuid().references(() => imports.id),
    details: jsonb(),
  },
  (t) => [
    // A1: the feed for all-country users, newest first.
    index('audit_events_occurred').on(t.occurredAt.desc().nullsFirst(), t.id.desc().nullsFirst()),
    // A2: the feed for users limited to some countries.
    index('audit_events_country_occurred').on(
      t.countryCode,
      t.occurredAt.desc().nullsFirst(),
      t.id.desc().nullsFirst(),
    ),
    // A3: one employee's timeline.
    index('audit_events_entity').on(
      t.entityType,
      t.entityId,
      t.occurredAt.desc().nullsFirst(),
      t.id.desc().nullsFirst(),
    ),
    check(
      'audit_events_action',
      sql`${t.action} in (${sql.raw(auditActions.map((a) => `'${a}'`).join(', '))})`,
    ),
    check(
      'audit_events_entity_type',
      sql`${t.entityType} in ('employee', 'import', 'export', 'user', 'role')`,
    ),
  ],
);
