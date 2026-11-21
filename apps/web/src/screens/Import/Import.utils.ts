import type {
  CatalogueRef,
  CountryInfo,
  ImportField,
  ImportOutcome,
  ImportRow,
} from '@acme/shared';
import { formatDate } from '../../lib/format';
import { formatMoney, minorToDecimalString } from '../../lib/money';

export type ImportStep = 'upload' | 'match' | 'review' | 'done';

export const IMPORT_STEPS = ['Upload', 'Match columns', 'Review', 'Import'] as const;

export const STEP_INDEX: Record<ImportStep, number> = { upload: 0, match: 1, review: 2, done: 3 };

export const IMPORT_FIELD_LABELS: Record<ImportField, string> = {
  employeeCode: 'Employee code',
  firstName: 'First name',
  lastName: 'Last name',
  email: 'Work email',
  country: 'Country',
  jobTitle: 'Job title',
  department: 'Department',
  hireDate: 'Hire date',
  salaryAmount: 'Annual salary',
  salaryEffectiveDate: 'Salary effective date',
};

export const OUTCOME_LABELS: Record<ImportOutcome, string> = {
  error: 'Need fixing',
  update: 'Updates',
  create: 'New',
  unchanged: 'Unchanged',
};

/** Labels for the employee fields an import row changes (`ImportRow.changes` keys), in display order. */
const CHANGE_LABELS: Record<string, string> = {
  firstName: 'First name',
  lastName: 'Last name',
  email: 'Work email',
  jobTitleId: 'Job title',
  departmentId: 'Department',
  countryCode: 'Country',
  hireDate: 'Hire date',
  salaryAmountMinor: 'Salary',
  salaryEffectiveDate: 'Salary effective date',
};

const CHANGE_ORDER = Object.keys(CHANGE_LABELS);

/** Unknown keys fall back to "someField" → "Some field" rather than showing the raw key. */
export function changeLabel(field: string): string {
  const known = CHANGE_LABELS[field];
  if (known) return known;
  const words = field.replace(/([a-z0-9])([A-Z])/g, '$1 $2').toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** What the review needs to turn change values (ids, minor units, ISO dates) into words. */
export interface ChangeContext {
  countries: readonly CountryInfo[];
  jobTitles: readonly CatalogueRef[];
  departments: readonly CatalogueRef[];
  /**
   * Currency of the employees an import updates, when it is certain: a one-country user, or a
   * file with no country column whose default country every matched employee must share.
   * Update rows carry no country, so without it salaries show without a currency.
   */
  updateCurrency?: string;
}

type ChangeValue = ImportRow['changes'][string]['from'];

/** Major units without a currency ("1,950,000"), when the row's currency isn't known. */
function formatBareAmount(amountMinor: number, countries: readonly CountryInfo[]): string {
  const units = new Set(countries.map((c) => c.minorUnits));
  const [fractionDigits] = units;
  if (units.size !== 1 || fractionDigits === undefined) return amountMinor.toLocaleString('en-US');
  const hasMinorPart = fractionDigits > 0 && amountMinor % 10 ** fractionDigits !== 0;
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: hasMinorPart ? fractionDigits : 0,
    maximumFractionDigits: fractionDigits,
  }).format(minorToDecimalString(amountMinor, fractionDigits) as Intl.StringNumericLiteral);
}

/**
 * The row's currency: its country (the file's for new employees, the matched employee's for
 * updates), else the import-wide one (if known).
 */
export function rowCurrency(row: ImportRow, context: ChangeContext): string | undefined {
  const code = row.changes.countryCode?.to ?? row.countryCode;
  if (typeof code === 'string') return context.countries.find((c) => c.code === code)?.currency;
  return context.updateCurrency;
}

export function formatChangeValue(
  field: string,
  value: ChangeValue,
  context: ChangeContext,
  currency?: string,
): string {
  if (value === null || value === '') return '—';
  switch (field) {
    case 'salaryAmountMinor':
      if (typeof value !== 'number') return String(value);
      return currency
        ? formatMoney({ amountMinor: value, currency })
        : formatBareAmount(value, context.countries);
    case 'hireDate':
    case 'salaryEffectiveDate':
      return formatDate(String(value));
    case 'jobTitleId':
      return context.jobTitles.find((t) => t.id === value)?.name ?? String(value);
    case 'departmentId':
      return context.departments.find((d) => d.id === value)?.name ?? String(value);
    case 'countryCode':
      return context.countries.find((c) => c.code === value)?.name ?? String(value);
    default:
      return String(value);
  }
}

/**
 * One human line per real change, in form order: "Salary: ₹19,00,000 → ₹19,50,000" for
 * updates, "Job title: Data Analyst" for new employees. Entries that don't change are left out.
 */
export function describeChanges(row: ImportRow, context: ChangeContext): string[] {
  const currency = rowCurrency(row, context);
  const rank = (field: string) => {
    const index = CHANGE_ORDER.indexOf(field);
    return index === -1 ? CHANGE_ORDER.length : index;
  };
  return Object.entries(row.changes)
    .filter(([, { from, to }]) => from !== to)
    .sort(([a], [b]) => rank(a) - rank(b))
    .map(([field, { from, to }]) => {
      const after = formatChangeValue(field, to, context, currency);
      if (row.outcome === 'create' || from === null) return `${changeLabel(field)}: ${after}`;
      return `${changeLabel(field)}: ${formatChangeValue(field, from, context, currency)} → ${after}`;
    });
}

/** A row's title in the review: the person's name, else their code, else "New employee". */
export function rowTitle(row: ImportRow): string {
  return row.employeeName || row.employeeCode || 'New employee';
}

/** The code under the name, when the title is the name (else the title already says it). */
export function rowSubtitle(row: ImportRow): string | undefined {
  if (!row.employeeName) return undefined;
  return row.employeeCode ?? (row.outcome === 'create' ? 'New employee' : undefined);
}

/** One line per problem: "Annual CTC: Not a positive amount". */
export function rowProblems(row: ImportRow): string[] {
  return row.errors.map((e) => (e.column ? `${e.column}: ${e.message}` : e.message));
}

/** The review table's detail cell: the problems for error rows, else the changes. */
export function rowDetail(row: ImportRow, context: ChangeContext): string {
  if (row.errors.length > 0) {
    return rowProblems(row).join(' · ');
  }
  const changes = describeChanges(row, context);
  if (changes.length === 0) return row.outcome === 'create' ? 'New employee' : 'No changes';
  return changes.join(' · ');
}
