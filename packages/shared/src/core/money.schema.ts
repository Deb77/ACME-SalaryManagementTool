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

/** A salary is always strictly positive. */
export const salaryAmountMinorSchema = z.int().positive();

export const moneySchema = z.object({
  amountMinor: amountMinorSchema,
  currency: currencyCodeSchema,
});

export type Money = z.infer<typeof moneySchema>;
