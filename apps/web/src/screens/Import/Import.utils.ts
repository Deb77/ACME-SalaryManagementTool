import type { ImportField, ImportOutcome } from '@acme/shared';

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

const CHANGE_LABELS: Record<string, string> = {
  salaryAmountMinor: 'Salary',
  jobTitleId: 'Job title',
  departmentId: 'Department',
  firstName: 'First name',
  lastName: 'Last name',
  email: 'Email',
  hireDate: 'Hire date',
};

export function changeLabel(field: string): string {
  return CHANGE_LABELS[field] ?? field;
}
