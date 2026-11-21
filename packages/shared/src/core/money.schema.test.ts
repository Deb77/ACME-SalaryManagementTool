import { describe, expect, it } from 'vitest';
import { moneySchema, salaryAmountMinorSchema } from './money.schema.js';

describe('moneySchema', () => {
  it('accepts whole minor units with a currency code', () => {
    expect(moneySchema.parse({ amountMinor: 125_000_000, currency: 'INR' })).toEqual({
      amountMinor: 125_000_000,
      currency: 'INR',
    });
  });

  it('rejects fractional amounts, so floats never reach the database', () => {
    expect(moneySchema.safeParse({ amountMinor: 1250.5, currency: 'GBP' }).success).toBe(false);
  });

  it('rejects amounts beyond the safe integer range', () => {
    const tooBig = Number.MAX_SAFE_INTEGER + 2;
    expect(moneySchema.safeParse({ amountMinor: tooBig, currency: 'GBP' }).success).toBe(false);
  });

  it('rejects amounts sent as strings', () => {
    expect(moneySchema.safeParse({ amountMinor: '100', currency: 'GBP' }).success).toBe(false);
  });

  it('rejects lower-case or unknown-shaped currency codes', () => {
    expect(moneySchema.safeParse({ amountMinor: 100, currency: 'gbp' }).success).toBe(false);
    expect(moneySchema.safeParse({ amountMinor: 100, currency: 'POUND' }).success).toBe(false);
  });
});

describe('salaryAmountMinorSchema', () => {
  it('rejects an implausibly large salary', () => {
    expect(salaryAmountMinorSchema.safeParse(100_000_000_001).success).toBe(false);
    expect(salaryAmountMinorSchema.safeParse(100_000_000_000).success).toBe(true);
  });

  it('rejects a zero or negative salary', () => {
    expect(salaryAmountMinorSchema.safeParse(0).success).toBe(false);
    expect(salaryAmountMinorSchema.safeParse(-1).success).toBe(false);
  });
});
