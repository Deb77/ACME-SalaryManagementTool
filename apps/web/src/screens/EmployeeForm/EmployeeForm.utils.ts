import type { FieldMessage } from '../shared/formErrors';

/** What the form holds for the fields whose message depends on whether they are empty. */
export interface EmployeeFieldValues {
  email: string;
  hireDate: string;
}

const tooLong =
  (field: string): FieldMessage =>
  (issue) =>
    issue.code === 'too_big' ? `Keep the ${field} under 100 characters` : undefined;

const name =
  (field: string): FieldMessage =>
  (issue) =>
    tooLong(field)(issue) ?? `Enter a ${field}`;

/**
 * Field-level copy for Add employee and Edit details, replacing the shared schema's
 * developer-facing messages ("Too small: expected string to have >=1 characters").
 */
export function employeeFieldMessages(values: EmployeeFieldValues): Record<string, FieldMessage> {
  return {
    firstName: name('first name'),
    lastName: name('last name'),
    email: () =>
      values.email.trim() === ''
        ? 'Enter a work email'
        : 'Enter an email address like name@acme.com',
    departmentId: () => 'Choose a department',
    jobTitleId: () => 'Choose a job title',
    country: () => 'Choose a country',
    hireDate: () =>
      values.hireDate === '' ? 'Enter the hire date' : 'Enter a date like 2026-04-01',
    salaryAmountMinor: (issue) => {
      if (issue.code === 'too_big') return 'That amount is too large for an annual salary';
      if (issue.code === 'too_small') return 'Enter an amount above zero';
      return 'Enter the annual salary';
    },
  };
}

/** Hire dates in the future are rejected by the API, so the form checks first. */
export function futureHireDateError(hireDate: string, today: string): string | undefined {
  return hireDate !== '' && hireDate > today ? 'Choose today or an earlier date' : undefined;
}
