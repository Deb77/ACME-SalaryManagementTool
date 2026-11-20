import { describe, expect, it } from 'vitest';
import { createSalaryChangeRequestSchema } from './salary-change.schema.js';

const raise = {
  amountMinor: 6_500_000,
  effectiveDate: '2026-12-01',
  reason: 'annual_review',
  version: 3,
};

describe('createSalaryChangeRequestSchema', () => {
  it('accepts an amount, effective date, reason and version', () => {
    expect(createSalaryChangeRequestSchema.parse(raise)).toEqual(raise);
  });

  it('requires a note for corrections', () => {
    const result = createSalaryChangeRequestSchema.safeParse({ ...raise, reason: 'correction' });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(['note']);
  });

  it('accepts a correction that explains itself', () => {
    const body = { ...raise, reason: 'correction', note: 'Typo in October import' };
    expect(createSalaryChangeRequestSchema.safeParse(body).success).toBe(true);
  });

  it('does not let users pick system-only reasons', () => {
    expect(createSalaryChangeRequestSchema.safeParse({ ...raise, reason: 'import' }).success).toBe(
      false,
    );
  });

  it('rejects a currency, because it follows the employee country', () => {
    const result = createSalaryChangeRequestSchema.safeParse({ ...raise, currency: 'USD' });
    expect(result.success).toBe(false);
  });

  it('rejects a zero salary', () => {
    expect(createSalaryChangeRequestSchema.safeParse({ ...raise, amountMinor: 0 }).success).toBe(
      false,
    );
  });
});
