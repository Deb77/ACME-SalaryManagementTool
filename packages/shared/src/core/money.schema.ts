import { z } from 'zod';

/** ISO 4217, e.g. `INR`, `GBP`. An employee's currency always follows their country. */
export const currencyCodeSchema = z
  .string()
  .regex(/^[A-Z]{3}$/, 'Expected a three-letter currency code such as "INR"');

/**
 * Whole minor units (paise, pence, cents). Never a float: `z.int()` rejects fractions and
 * anything outside the safe-integer range.
 */
export const amountMinorSchema = z.int().nonnegative();

/**
 * Largest annual salary accepted: 1,000,000,000 major units (₹100 crore, £1bn) in minor units.
 * It keeps payroll sums over 10,000 people (≤ 1e15) inside JavaScript's safe-integer range, so
 * insights never lose precision; real salaries are orders of magnitude below it.
 */
export const MAX_SALARY_MINOR = 100_000_000_000;

/** A salary is always strictly positive and below `MAX_SALARY_MINOR`. */
export const salaryAmountMinorSchema = z
  .int()
  .positive('Enter an amount above zero')
  .max(MAX_SALARY_MINOR, 'That amount is too large for an annual salary');

export const moneySchema = z.object({
  amountMinor: amountMinorSchema,
  currency: currencyCodeSchema,
});

export type Money = z.infer<typeof moneySchema>;
