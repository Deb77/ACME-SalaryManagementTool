import { describe, expect, it } from 'vitest';
import { checkSalaryChange, type SalaryChangeCheck } from './salary.rules.js';

const TODAY = '2026-06-15';

const current = {
  status: 'active' as const,
  version: 3,
  salaryAmountMinor: 5_000_000,
  salaryEffectiveDate: '2026-01-01',
};

const raise = (overrides: Partial<SalaryChangeCheck['input']> = {}): SalaryChangeCheck => ({
  current,
  input: { amountMinor: 5_500_000, effectiveDate: TODAY, reason: 'annual_review', ...overrides },
  today: TODAY,
});

/** The broken rule and its field, so each test reads as one expectation. */
const broken = (check: SalaryChangeCheck) => {
  const violation = checkSalaryChange(check);
  return violation && { rule: violation.rule, field: violation.field };
};

describe('checkSalaryChange', () => {
  it('accepts a raise effective today', () => {
    expect(checkSalaryChange(raise())).toBeNull();
  });

  it('accepts a change dated on the latest entry', () => {
    expect(checkSalaryChange(raise({ effectiveDate: current.salaryEffectiveDate }))).toBeNull();
  });

  it('rejects a change based on an older version of the employee', () => {
    expect(broken(raise({ version: 2 }))).toEqual({ rule: 'stale_version', field: undefined });
  });

  it('skips the version check when none is sent (imports lock and re-read)', () => {
    expect(checkSalaryChange(raise({ version: undefined }))).toBeNull();
  });

  it('rejects a change for someone who has left', () => {
    const check = { ...raise(), current: { ...current, status: 'terminated' as const } };
    expect(broken(check)).toEqual({ rule: 'employee_left', field: undefined });
  });

  it('rejects an effective date before the latest entry', () => {
    expect(broken(raise({ effectiveDate: '2025-12-31' }))).toEqual({
      rule: 'before_latest_entry',
      field: 'effectiveDate',
    });
  });

  it('rejects a future effective date', () => {
    expect(broken(raise({ effectiveDate: '2026-06-16' }))).toEqual({
      rule: 'future_date',
      field: 'effectiveDate',
    });
  });

  it('allows a future effective date from an import or its undo', () => {
    expect(checkSalaryChange(raise({ effectiveDate: '2026-07-01', reason: 'import' }))).toBeNull();
    expect(
      checkSalaryChange(raise({ effectiveDate: '2026-07-01', reason: 'import_undo' })),
    ).toBeNull();
  });

  it('rejects the same amount as the current salary', () => {
    expect(broken(raise({ amountMinor: current.salaryAmountMinor }))).toEqual({
      rule: 'same_amount',
      field: 'amountMinor',
    });
  });

  it('allows the same amount for a correction or an import row', () => {
    const same = current.salaryAmountMinor;
    expect(checkSalaryChange(raise({ amountMinor: same, reason: 'correction' }))).toBeNull();
    expect(checkSalaryChange(raise({ amountMinor: same, importId: 'import-1' }))).toBeNull();
  });

  it('explains each rule in words the user can act on', () => {
    expect(checkSalaryChange(raise({ effectiveDate: '2025-12-31' }))?.message).toBe(
      'Must be on or after the latest salary entry (2026-01-01). Fix a past amount with a correction.',
    );
  });
});
