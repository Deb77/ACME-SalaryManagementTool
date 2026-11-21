import { sql } from 'drizzle-orm';
import {
  char,
  check,
  date,
  numeric,
  pgTable,
  primaryKey,
  smallint,
  text,
  unique,
} from 'drizzle-orm/pg-core';
import { SLUG_PATTERN } from './types.js';

/**
 * Countries, departments, job titles and fixed FX rates. Not editable in v1 (docs/api.md,
 * Meta): the rows are written by a migration, not by the app.
 */
export const countries = pgTable(
  'countries',
  {
    code: char({ length: 2 }).primaryKey(),
    name: text().notNull().unique(),
    currency: char({ length: 3 }).notNull(),
    minorUnits: smallint().notNull(),
  },
  (t) => [
    // Target of the composite foreign key that makes "currency follows country" a database rule.
    unique('countries_code_currency').on(t.code, t.currency),
    check('countries_code_format', sql`${t.code} ~ '^[A-Z]{2}$'`),
    check('countries_currency_format', sql`${t.currency} ~ '^[A-Z]{3}$'`),
    check('countries_minor_units', sql`${t.minorUnits} between 0 and 3`),
  ],
);

export const departments = pgTable(
  'departments',
  { id: text().primaryKey(), name: text().notNull().unique() },
  (t) => [check('departments_id_format', sql`${t.id} ~ ${sql.raw(SLUG_PATTERN)}`)],
);

export const jobTitles = pgTable(
  'job_titles',
  { id: text().primaryKey(), name: text().notNull().unique() },
  (t) => [check('job_titles_id_format', sql`${t.id} ~ ${sql.raw(SLUG_PATTERN)}`)],
);

export const fxRates = pgTable(
  'fx_rates',
  {
    asOf: date({ mode: 'string' }).notNull(),
    currency: char({ length: 3 }).notNull(),
    /** USD per one major unit. Not money, so numeric rather than minor units. */
    usdPerUnit: numeric({ precision: 20, scale: 10 }).notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.asOf, t.currency] }),
    check('fx_rates_currency_format', sql`${t.currency} ~ '^[A-Z]{3}$'`),
    check('fx_rates_positive', sql`${t.usdPerUnit} > 0`),
  ],
);
