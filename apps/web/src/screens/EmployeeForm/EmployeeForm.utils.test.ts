import { createEmployeeRequestSchema } from '@acme/shared';
import { describe, expect, it } from 'vitest';
import { zodFieldErrors } from '../shared/formErrors';
import { employeeFieldMessages, futureHireDateError } from './EmployeeForm.utils';

const valid = {
  firstName: 'Priya',
  lastName: 'Sharma',
  email: 'priya@acme.example',
  departmentId: 'data',
  jobTitleId: 'data-analyst',
  country: 'IN',
  hireDate: '2026-04-01',
  salaryAmountMinor: 1_200_000_00,
};

const errorsFor = (draft: Record<string, unknown>) => {
  const parsed = createEmployeeRequestSchema.safeParse(draft);
  if (parsed.success) return {};
  return zodFieldErrors(
    parsed.error,
    employeeFieldMessages({ email: String(draft.email ?? ''), hireDate: String(draft.hireDate) }),
  );
};

describe('employeeFieldMessages', () => {
  it('asks for every empty field in plain words', () => {
    expect(
      errorsFor({
        firstName: ' ',
        lastName: '',
        email: '',
        departmentId: '',
        jobTitleId: '',
        country: '',
        hireDate: '',
        salaryAmountMinor: undefined,
      }),
    ).toEqual({
      firstName: 'Enter a first name',
      lastName: 'Enter a last name',
      email: 'Enter a work email',
      departmentId: 'Choose a department',
      jobTitleId: 'Choose a job title',
      country: 'Choose a country',
      hireDate: 'Enter the hire date',
      salaryAmountMinor: 'Enter the annual salary',
    });
  });

  it('explains values that are present but wrong', () => {
    expect(
      errorsFor({
        ...valid,
        firstName: 'x'.repeat(101),
        email: 'priya@',
        salaryAmountMinor: 0,
      }),
    ).toEqual({
      firstName: 'Keep the first name under 100 characters',
      email: 'Enter an email address like name@acme.com',
      salaryAmountMinor: 'Enter an amount above zero',
    });
    expect(errorsFor({ ...valid, salaryAmountMinor: 10 ** 15 })).toEqual({
      salaryAmountMinor: 'That amount is too large for an annual salary',
    });
  });
});

describe('futureHireDateError', () => {
  it('rejects only dates after today', () => {
    expect(futureHireDateError('2026-11-21', '2026-11-20')).toBe('Choose today or an earlier date');
    expect(futureHireDateError('2026-11-20', '2026-11-20')).toBeUndefined();
    expect(futureHireDateError('', '2026-11-20')).toBeUndefined();
  });
});
