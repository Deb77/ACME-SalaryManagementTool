import { describe, expect, it } from 'vitest';
import { AppError } from '../../lib/errors.js';
import { checkHireDate } from './employee.rules.js';

const TODAY = '2026-06-15';

function failure(run: () => void) {
  try {
    run();
  } catch (error) {
    if (error instanceof AppError) return error.details?.[0];
    throw error;
  }
  return undefined;
}

describe('checkHireDate', () => {
  it('accepts a hire date of today or earlier', () => {
    expect(failure(() => checkHireDate({ hireDate: TODAY, today: TODAY }))).toBeUndefined();
    expect(failure(() => checkHireDate({ hireDate: '2020-02-29', today: TODAY }))).toBeUndefined();
  });

  it('rejects a hire date in the future', () => {
    expect(failure(() => checkHireDate({ hireDate: '2026-06-16', today: TODAY }))).toEqual({
      path: 'hireDate',
      message: 'The hire date cannot be in the future yet',
    });
  });

  it('rejects a new hire date after the current salary took effect', () => {
    const check = { hireDate: '2026-03-01', today: TODAY, salaryEffectiveDate: '2026-02-01' };
    expect(failure(() => checkHireDate(check))).toEqual({
      path: 'hireDate',
      message: "Must be on or before the current salary's effective date (2026-02-01)",
    });
  });

  it('accepts a new hire date on the day the current salary took effect', () => {
    const check = { hireDate: '2026-02-01', today: TODAY, salaryEffectiveDate: '2026-02-01' };
    expect(failure(() => checkHireDate(check))).toBeUndefined();
  });
});
