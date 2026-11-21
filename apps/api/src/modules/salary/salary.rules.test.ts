import { describe, expect, it } from 'vitest';
import { AppError } from '../../lib/errors.js';
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

/** The error a rule throws, as { code, path } so each test reads as one expectation. */
function failure(check: SalaryChangeCheck) {
  try {
    checkSalaryChange(check);
  } catch (error) {
    if (error instanceof AppError) return { code: error.code, path: error.details?.[0]?.path };
    throw error;
  }
  return undefined;
}

describe('checkSalaryChange', () => {
  it('accepts a raise effective today', () => {
    expect(failure(raise())).toBeUndefined();
  });

  it('accepts a change dated on the latest entry', () => {
    expect(failure(raise({ effectiveDate: current.salaryEffectiveDate }))).toBeUndefined();
  });

  it('rejects a change based on an older version of the employee', () => {
    expect(failure(raise({ version: 2 }))).toEqual({ code: 'stale_version', path: undefined });
  });

  it('skips the version check when none is sent (imports lock and re-read)', () => {
    expect(failure(raise({ version: undefined }))).toBeUndefined();
  });

  it('rejects a change for someone who has left', () => {
    const check = { ...raise(), current: { ...current, status: 'terminated' as const } };
    expect(failure(check)).toEqual({ code: 'conflict', path: undefined });
  });

  it('rejects an effective date before the latest entry', () => {
    expect(failure(raise({ effectiveDate: '2025-12-31' }))).toEqual({
      code: 'validation_error',
      path: 'effectiveDate',
    });
  });

  it('rejects a future effective date', () => {
    expect(failure(raise({ effectiveDate: '2026-06-16' }))).toEqual({
      code: 'validation_error',
      path: 'effectiveDate',
    });
  });

  it('allows a future effective date from an import or its undo', () => {
    expect(failure(raise({ effectiveDate: '2026-07-01', reason: 'import' }))).toBeUndefined();
    expect(failure(raise({ effectiveDate: '2026-07-01', reason: 'import_undo' }))).toBeUndefined();
  });

  it('rejects the same amount as the current salary', () => {
    expect(failure(raise({ amountMinor: current.salaryAmountMinor }))).toEqual({
      code: 'validation_error',
      path: 'amountMinor',
    });
  });

  it('allows the same amount for a correction or an import row', () => {
    const same = current.salaryAmountMinor;
    expect(failure(raise({ amountMinor: same, reason: 'correction' }))).toBeUndefined();
    expect(failure(raise({ amountMinor: same, importId: 'import-1' }))).toBeUndefined();
  });
});
