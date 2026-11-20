/**
 * Money helpers. Amounts are always integer minor units (paise, cents) plus an
 * ISO 4217 currency code; we never turn them into floating-point numbers.
 * Formatting goes through Intl.NumberFormat's exact decimal-string input.
 */

import type { Money } from '@acme/shared';

export type { Money };

export interface FormatMoneyOptions {
  locale?: string;
  /** Show "+" for positive amounts, for salary changes and deltas. */
  signed?: boolean;
  /** Short form such as ₹7.2L or $92K, for chart axes and dense summaries. */
  compact?: boolean;
}

/** Locale whose digit grouping each currency's users expect (₹32,40,000 for INR). */
const LOCALE_BY_CURRENCY: Record<string, string> = {
  INR: 'en-IN',
  GBP: 'en-GB',
};

export function localeForCurrency(currency: string): string {
  return LOCALE_BY_CURRENCY[currency] ?? 'en-US';
}

export function currencyFractionDigits(currency: string): number {
  return new Intl.NumberFormat('en', { style: 'currency', currency }).resolvedOptions()
    .maximumFractionDigits as number;
}

/** 3240000 minor INR -> "32400.00"; exact string arithmetic, no division. */
export function minorToDecimalString(amountMinor: number, fractionDigits: number): string {
  if (!Number.isSafeInteger(amountMinor)) {
    throw new RangeError(`amountMinor must be a safe integer, got ${amountMinor}`);
  }
  const sign = amountMinor < 0 ? '-' : '';
  const digits = String(Math.abs(amountMinor));
  if (fractionDigits === 0) return `${sign}${digits}`;
  const padded = digits.padStart(fractionDigits + 1, '0');
  return `${sign}${padded.slice(0, -fractionDigits)}.${padded.slice(-fractionDigits)}`;
}

/**
 * Parses what a person typed ("35,00,000" or "1234.5") into minor units.
 * Returns null when the text is not a valid amount for the currency.
 */
export function parseMajorToMinor(input: string, currency: string): number | null {
  const fractionDigits = currencyFractionDigits(currency);
  const cleaned = input.replace(/[\s,]/g, '');
  const match = /^(-?)(\d+)(?:\.(\d*))?$/.exec(cleaned);
  if (!match) return null;
  const [, sign = '', whole = '0', fraction = ''] = match;
  if (fraction.length > fractionDigits) return null;
  const minor = Number(`${whole}${fraction.padEnd(fractionDigits, '0')}`);
  if (!Number.isSafeInteger(minor)) return null;
  return sign === '-' ? -minor : minor;
}

export function formatMoney(
  { amountMinor, currency }: Money,
  { locale, signed = false, compact = false }: FormatMoneyOptions = {},
): string {
  const fractionDigits = currencyFractionDigits(currency);
  const hasMinorPart = fractionDigits > 0 && amountMinor % 10 ** fractionDigits !== 0;
  const formatter = new Intl.NumberFormat(locale ?? localeForCurrency(currency), {
    style: 'currency',
    currency,
    signDisplay: signed ? 'exceptZero' : 'auto',
    ...(compact
      ? { notation: 'compact', maximumFractionDigits: 1 }
      : { minimumFractionDigits: hasMinorPart ? fractionDigits : 0 }),
  });
  const decimal = minorToDecimalString(amountMinor, fractionDigits);
  return formatter.format(decimal as Intl.StringNumericLiteral);
}
