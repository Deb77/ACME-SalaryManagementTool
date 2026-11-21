import { describe, expect, it } from 'vitest';
import { checkHireDate, checkTerminationDate } from './employee.rules.js';

const TODAY = '2026-06-15';

describe('checkHireDate', () => {
  it('accepts a hire date of today or earlier', () => {
    expect(checkHireDate({ hireDate: TODAY, today: TODAY })).toBeNull();
    expect(checkHireDate({ hireDate: '2020-02-29', today: TODAY })).toBeNull();
  });

  it('rejects a hire date in the future', () => {
    expect(checkHireDate({ hireDate: '2026-06-16', today: TODAY })).toMatchObject({
      rule: 'future_date',
      field: 'hireDate',
      message: 'The hire date cannot be in the future yet',
    });
  });

  it('rejects a new hire date after the current salary took effect', () => {
    const check = { hireDate: '2026-03-01', today: TODAY, salaryEffectiveDate: '2026-02-01' };
    expect(checkHireDate(check)).toMatchObject({
      rule: 'hired_after_pay',
      field: 'hireDate',
      message: "Must be on or before the current salary's effective date (2026-02-01)",
    });
  });

  it('accepts a new hire date on the day the current salary took effect', () => {
    const check = { hireDate: '2026-02-01', today: TODAY, salaryEffectiveDate: '2026-02-01' };
    expect(checkHireDate(check)).toBeNull();
  });
});

describe('checkTerminationDate', () => {
  const hireDate = '2024-05-01';

  it('accepts a leaving date between the hire date and today', () => {
    expect(checkTerminationDate({ terminationDate: hireDate, hireDate, today: TODAY })).toBeNull();
    expect(checkTerminationDate({ terminationDate: TODAY, hireDate, today: TODAY })).toBeNull();
  });

  it('rejects a leaving date in the future', () => {
    expect(
      checkTerminationDate({ terminationDate: '2026-06-16', hireDate, today: TODAY }),
    ).toMatchObject({ rule: 'future_date', field: 'terminationDate' });
  });

  it('rejects a leaving date before the hire date', () => {
    expect(
      checkTerminationDate({ terminationDate: '2024-04-30', hireDate, today: TODAY }),
    ).toMatchObject({
      rule: 'left_before_hired',
      field: 'terminationDate',
      message: 'Must be on or after the hire date (2024-05-01)',
    });
  });
});
