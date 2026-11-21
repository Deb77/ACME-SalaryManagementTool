import { Input } from '@mantine/core';
import { forwardRef, useState, type ComponentPropsWithoutRef } from 'react';
import {
  currencyFractionDigits,
  localeForCurrency,
  minorToDecimalString,
  parseMajorToMinor,
} from '../../../lib/money';
import styles from './MoneyInput.module.css';

export interface MoneyInputProps {
  id?: string;
  currency: string;
  /** Initial amount in minor units; the input keeps its own text after that. */
  defaultValueMinor?: number | null;
  /** Called with integer minor units, or null while the text is not a valid amount. */
  onChange: (amountMinor: number | null) => void;
  'aria-describedby'?: string;
  'aria-invalid'?: boolean;
  disabled?: boolean;
}

/**
 * Mantine's Input sets `aria-describedby` from its own wrapper (none here), which would drop
 * the hint/error id FormField passes in. This element restores it from a data attribute.
 */
const DescribedInput = forwardRef<
  HTMLInputElement,
  ComponentPropsWithoutRef<'input'> & { 'data-describedby'?: string }
>(function DescribedInput({ 'data-describedby': describedBy, ...props }, ref) {
  return <input {...props} ref={ref} aria-describedby={describedBy} />;
});

function currencySymbol(currency: string): string {
  const parts = new Intl.NumberFormat(localeForCurrency(currency), {
    style: 'currency',
    currency,
  }).formatToParts(0);
  return parts.find((part) => part.type === 'currency')?.value ?? currency;
}

function formatPlain(amountMinor: number, currency: string): string {
  const digits = currencyFractionDigits(currency);
  const hasMinor = digits > 0 && amountMinor % 10 ** digits !== 0;
  return new Intl.NumberFormat(localeForCurrency(currency), {
    minimumFractionDigits: hasMinor ? digits : 0,
    maximumFractionDigits: digits,
  }).format(minorToDecimalString(amountMinor, digits) as Intl.StringNumericLiteral);
}

/**
 * Amount input with the currency shown as a prefix ("INR ₹", or just "SGD"). People type
 * major units with any grouping; the parent only ever receives minor units.
 * Re-formats with the currency's grouping when the field loses focus.
 */
export function MoneyInput({
  id,
  currency,
  defaultValueMinor = null,
  onChange,
  disabled,
  ...aria
}: MoneyInputProps) {
  const [text, setText] = useState(() =>
    defaultValueMinor === null ? '' : formatPlain(defaultValueMinor, currency),
  );
  const symbol = currencySymbol(currency);
  // Some currencies (SGD, CHF in en-US) have no symbol of their own: show the code once.
  const prefix = symbol === currency ? currency : `${currency} ${symbol}`;

  return (
    <Input
      id={id}
      inputMode="decimal"
      autoComplete="off"
      disabled={disabled}
      component={DescribedInput}
      data-describedby={aria['aria-describedby']}
      error={aria['aria-invalid'] ? true : undefined}
      leftSection={<span className={styles.prefix}>{prefix}</span>}
      // Wide enough for "INR ₹" or "USD $"; the section is absolutely positioned.
      leftSectionWidth={prefix.length * 9 + 16}
      classNames={{ input: styles.input }}
      value={text}
      onChange={(event) => {
        setText(event.currentTarget.value);
        onChange(parseMajorToMinor(event.currentTarget.value, currency));
      }}
      onBlur={() => {
        const minor = parseMajorToMinor(text, currency);
        if (minor !== null) setText(formatPlain(minor, currency));
      }}
      {...aria}
    />
  );
}
