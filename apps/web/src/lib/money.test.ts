import { describe, expect, it } from 'vitest';
import { formatMoney, minorToDecimalString, parseMajorToMinor, roundToMajor } from './money';

describe('minorToDecimalString', () => {
  it('places the decimal point without floating-point arithmetic', () => {
    expect(minorToDecimalString(3_240_000_00, 2)).toBe('3240000.00');
    expect(minorToDecimalString(5, 2)).toBe('0.05');
    expect(minorToDecimalString(-1999, 2)).toBe('-19.99');
    expect(minorToDecimalString(1200, 0)).toBe('1200');
  });

  it('rejects non-integer amounts', () => {
    expect(() => minorToDecimalString(10.5, 2)).toThrow(RangeError);
  });
});

describe('formatMoney', () => {
  it('uses Indian digit grouping for rupees', () => {
    expect(formatMoney({ amountMinor: 3_240_000_00, currency: 'INR' })).toBe('₹32,40,000');
  });

  it('shows minor units only when the amount has them', () => {
    expect(formatMoney({ amountMinor: 9_200_000, currency: 'USD' })).toBe('$92,000');
    expect(formatMoney({ amountMinor: 9_200_050, currency: 'USD' })).toBe('$92,000.50');
  });

  it('formats currencies without minor units', () => {
    expect(formatMoney({ amountMinor: 5_000_000, currency: 'JPY' })).toBe('¥5,000,000');
  });

  it('adds a plus sign to positive changes when signed', () => {
    expect(formatMoney({ amountMinor: 260_000_00, currency: 'INR' }, { signed: true })).toBe(
      '+₹2,60,000',
    );
    expect(formatMoney({ amountMinor: -50_000, currency: 'GBP' }, { signed: true })).toBe('-£500');
  });

  it('abbreviates large amounts in compact mode', () => {
    expect(formatMoney({ amountMinor: 720_000_00, currency: 'INR' }, { compact: true })).toBe(
      '₹7.2L',
    );
  });
});

describe('parseMajorToMinor', () => {
  it('accepts grouped input and returns integer minor units', () => {
    expect(parseMajorToMinor('35,00,000', 'INR')).toBe(3_500_000_00);
    expect(parseMajorToMinor('1234.5', 'USD')).toBe(123_450);
  });

  it('rejects text and too many decimals', () => {
    expect(parseMajorToMinor('abc', 'USD')).toBeNull();
    expect(parseMajorToMinor('10.123', 'USD')).toBeNull();
    expect(parseMajorToMinor('10.5', 'JPY')).toBeNull();
  });
});

describe('roundToMajor', () => {
  it('rounds minor units to whole major units, half up', () => {
    expect(roundToMajor(6_532_145, 'USD')).toBe(6_532_100);
    expect(roundToMajor(6_532_150, 'USD')).toBe(6_532_200);
    expect(roundToMajor(1_234, 'JPY')).toBe(1_234);
  });
});
