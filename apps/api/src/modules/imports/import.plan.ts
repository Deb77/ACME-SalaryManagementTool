import {
  MAX_SALARY_MINOR,
  type ImportField,
  type ImportMapping,
  type ImportMappingRequest,
  type ImportOutcome,
} from '@acme/shared';
import { canUseCountry } from '../../auth/actor.js';
import type { Catalogue } from '../meta/catalogue.service.js';
import type { EmployeeRow } from '../employees/employee.repository.js';

export interface PlannedValues {
  employeeCode?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  countryCode?: string;
  jobTitleId?: string;
  departmentId?: string;
  hireDate?: string;
  salaryAmountMinor?: number;
  salaryEffectiveDate?: string;
}

export type ChangeValue = string | number | null;

export interface PlannedRow {
  rowNumber: number;
  outcome: ImportOutcome;
  employeeCode: string | null;
  employeeId: string | null;
  countryCode: string | null;
  changes: Record<string, { from: ChangeValue; to: ChangeValue }>;
  errors: { column: string; message: string }[];
  /** What a create or update writes; empty for errors and unchanged rows. */
  values: PlannedValues;
}

export interface PlanContext {
  catalogue: Catalogue;
  /** Countries the actor may import into. */
  countries: readonly string[];
  /** Existing employees the actor can see, by code and by lower-case email. */
  byCode: ReadonlyMap<string, EmployeeRow>;
  byEmail: ReadonlyMap<string, EmployeeRow>;
  today: string;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CODE = /^[A-Z0-9-]{3,20}$/;
/** Header row is spreadsheet row 1, so data row i (0-based) is row i + 2. */
export const rowNumberOf = (index: number) => index + 2;

/** `YYYY-MM-DD`, `DD/MM/YYYY`, `DD-MM-YYYY` or `DD.MM.YYYY`; a real calendar date. */
export function parseDate(text: string): string | undefined {
  let y: number, m: number, d: number;
  let match = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(text);
  if (match) [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])];
  else if ((match = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(text))) {
    [d, m, y] = [Number(match[1]), Number(match[2]), Number(match[3])];
  } else return undefined;
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d)
    return undefined;
  if (y < 1950 || y > 2100) return undefined;
  return date.toISOString().slice(0, 10);
}

/** "1,800,000.50", "₹ 18,00,000", "£52000" → minor units; undefined when not a positive amount. */
export function parseAmountMinor(text: string, minorUnits: number): number | undefined {
  const cleaned = text.replace(/[\s,'\u00a0]/g, '').replace(/^[^\d.-]+/, '');
  if (!/^\d+(\.\d+)?$/.test(cleaned)) return undefined;
  const [whole = '0', fraction = ''] = cleaned.split('.');
  if (fraction.length > minorUnits) return undefined;
  const minor = Number(whole) * 10 ** minorUnits + Number(fraction.padEnd(minorUnits, '0') || 0);
  return Number.isSafeInteger(minor) && minor > 0 && minor <= MAX_SALARY_MINOR ? minor : undefined;
}

function lookup(list: readonly { id: string; name: string }[], text: string) {
  const wanted = text.trim().toLowerCase();
  return list.find((item) => item.id === wanted || item.name.toLowerCase() === wanted)?.id;
}

const updatable = [
  'firstName',
  'lastName',
  'email',
  'jobTitleId',
  'departmentId',
  'hireDate',
  'salaryAmountMinor',
] as const;

/**
 * The dry run for every row (docs/api.md, Import flow): validates, matches existing employees
 * by code then email, and decides create / update / unchanged / error. Pure, so commit can
 * re-run it inside its transaction and compare.
 */
export function planRows(
  columns: readonly string[],
  rows: readonly string[][],
  { mapping, defaults }: ImportMappingRequest,
  ctx: PlanContext,
): PlannedRow[] {
  const index = new Map(columns.map((c, i) => [c, i]));
  const seenCodes = new Map<string, number>();
  const seenEmails = new Map<string, number>();

  return rows.map((row, i) => {
    const rowNumber = rowNumberOf(i);
    const errors: { column: string; message: string }[] = [];
    const column = (field: ImportField) => mapping[field] ?? field;
    const read = (field: ImportField) => {
      const header = mapping[field];
      if (header === undefined) return '';
      const at = index.get(header);
      return at === undefined ? '' : (row[at] ?? '').trim();
    };
    const fail = (field: ImportField, message: string) =>
      errors.push({ column: column(field), message });

    // --- read and type every mapped cell ---
    const v: PlannedValues = {};
    const code = read('employeeCode').toUpperCase();
    if (code) {
      if (CODE.test(code)) v.employeeCode = code;
      else fail('employeeCode', 'Use 3–20 capital letters, digits or dashes, e.g. ACM-000123');
    }
    const first = read('firstName');
    if (first) v.firstName = first.slice(0, 100);
    const last = read('lastName');
    if (last) v.lastName = last.slice(0, 100);
    const email = read('email').toLowerCase();
    if (email) {
      if (EMAIL.test(email)) v.email = email;
      else fail('email', 'Not a valid email address');
    }
    const countryText = (read('country') || defaults?.country || '').toUpperCase();
    if (countryText) {
      const byName = ctx.catalogue.countries.find((c) => c.name.toUpperCase() === countryText);
      const country = ctx.catalogue.countryByCode.has(countryText) ? countryText : byName?.code;
      if (!country) fail('country', `Unknown country "${countryText}"`);
      else if (!canUseCountry(ctx, country)) {
        fail('country', `${country} is outside your countries. Ask Global HR to make this change.`);
      } else v.countryCode = country;
    }
    const title = read('jobTitle');
    if (title) {
      v.jobTitleId = lookup(ctx.catalogue.jobTitles, title);
      if (!v.jobTitleId) fail('jobTitle', `Unknown job title "${title}"`);
    }
    const department = read('department');
    if (department) {
      v.departmentId = lookup(ctx.catalogue.departments, department);
      if (!v.departmentId) fail('department', `Unknown department "${department}"`);
    }
    const hire = read('hireDate');
    if (hire) {
      v.hireDate = parseDate(hire);
      if (!v.hireDate) fail('hireDate', 'Not a date; use YYYY-MM-DD');
      else if (v.hireDate > ctx.today) fail('hireDate', 'Future hire dates are not supported yet');
    }
    const effective = read('salaryEffectiveDate') || defaults?.salaryEffectiveDate || '';
    if (effective) {
      v.salaryEffectiveDate = parseDate(effective);
      if (!v.salaryEffectiveDate) fail('salaryEffectiveDate', 'Not a date; use YYYY-MM-DD');
      else if (v.salaryEffectiveDate > ctx.today)
        fail('salaryEffectiveDate', 'Future-dated salaries are not supported yet');
    }

    // --- match an existing employee: code first, then email ---
    const existing =
      (v.employeeCode && ctx.byCode.get(v.employeeCode)) ||
      (v.email && !v.employeeCode ? ctx.byEmail.get(v.email) : undefined) ||
      undefined;
    if (v.employeeCode && !existing && v.email && ctx.byEmail.has(v.email)) {
      fail('email', `Already used by ${ctx.byEmail.get(v.email)!.employeeCode}`);
    }

    const country = existing?.countryCode ?? v.countryCode;
    const salaryText = read('salaryAmount');
    if (salaryText) {
      const currency = country ? ctx.catalogue.countryByCode.get(country)?.currency : undefined;
      const minorUnits = currency ? ctx.catalogue.minorUnitsOf(currency) : 2;
      v.salaryAmountMinor = parseAmountMinor(salaryText, minorUnits);
      if (v.salaryAmountMinor === undefined) fail('salaryAmount', 'Not a positive amount');
    }

    // --- duplicates inside the file ---
    const key = existing?.id ?? v.employeeCode;
    if (key) {
      const earlier = seenCodes.get(key);
      if (earlier) fail('employeeCode', `Same employee as row ${earlier}`);
      else seenCodes.set(key, rowNumber);
    }
    if (v.email) {
      const earlier = seenEmails.get(v.email);
      if (earlier) fail('email', `Same email as row ${earlier}`);
      else seenEmails.set(v.email, rowNumber);
    }

    const base = {
      rowNumber,
      employeeCode: existing?.employeeCode ?? v.employeeCode ?? null,
      employeeId: existing?.id ?? null,
      countryCode: country ?? null,
    };

    if (existing) {
      if (v.countryCode && v.countryCode !== existing.countryCode) {
        fail(
          'country',
          `Moving from ${existing.countryCode} to ${v.countryCode} is not supported; it changes the currency`,
        );
      }
      if (existing.status === 'terminated')
        fail('employeeCode', 'This employee has left; reinstating is not supported');
      const changes: PlannedRow['changes'] = {};
      for (const field of updatable) {
        const to = v[field];
        if (to === undefined) continue;
        const from = existing[field];
        if (from !== to) changes[field] = { from, to };
      }
      if (changes.salaryAmountMinor) {
        const date = v.salaryEffectiveDate;
        if (!date)
          fail(
            'salaryEffectiveDate',
            'A salary change needs an effective date (map a column or set a default)',
          );
        else if (date < existing.salaryEffectiveDate) {
          fail(
            'salaryEffectiveDate',
            `Must be on or after the latest salary entry (${existing.salaryEffectiveDate})`,
          );
        } else changes.salaryEffectiveDate = { from: existing.salaryEffectiveDate, to: date };
      }
      if (errors.length > 0) return { ...base, outcome: 'error', changes: {}, errors, values: {} };
      if (Object.keys(changes).length === 0)
        return { ...base, outcome: 'unchanged', changes: {}, errors, values: {} };
      const values: PlannedValues = {};
      for (const [field, change] of Object.entries(changes)) {
        (values as Record<string, ChangeValue>)[field] = change.to;
      }
      return { ...base, outcome: 'update', changes, errors, values };
    }

    // --- new employee: every field is needed ---
    const required: [ImportField, unknown][] = [
      ['firstName', v.firstName],
      ['lastName', v.lastName],
      ['email', v.email],
      ['country', v.countryCode],
      ['jobTitle', v.jobTitleId],
      ['department', v.departmentId],
      ['hireDate', v.hireDate],
      ['salaryAmount', v.salaryAmountMinor],
    ];
    for (const [field, value] of required) {
      if (value === undefined && !errors.some((e) => e.column === column(field)))
        fail(field, 'Required for a new employee');
    }
    if (errors.length > 0) return { ...base, outcome: 'error', changes: {}, errors, values: {} };
    // A default effective date (not a column) never predates a new joiner's hire date.
    if (
      !v.salaryEffectiveDate ||
      (!read('salaryEffectiveDate') && v.salaryEffectiveDate < v.hireDate!)
    ) {
      v.salaryEffectiveDate = v.hireDate;
    }
    if (v.salaryEffectiveDate! < v.hireDate!) {
      fail('salaryEffectiveDate', 'Must be on or after the hire date');
      return { ...base, outcome: 'error', changes: {}, errors, values: {} };
    }
    const changes: PlannedRow['changes'] = {};
    for (const field of [...updatable, 'countryCode', 'salaryEffectiveDate'] as const) {
      const to = v[field];
      if (to !== undefined) changes[field] = { from: null, to };
    }
    return { ...base, outcome: 'create', changes, errors, values: v };
  });
}

export function summarise(rows: readonly Pick<PlannedRow, 'outcome'>[]) {
  const summary = { rows: rows.length, create: 0, update: 0, unchanged: 0, error: 0 };
  for (const row of rows) summary[row.outcome] += 1;
  return summary;
}

export type { ImportMapping };
