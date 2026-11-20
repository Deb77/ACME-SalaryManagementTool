import { formatMoney, type Money } from '../../../lib/money';

export interface MoneyTextProps extends Money {
  /** Prefix positive amounts with "+" and colour gains and losses. */
  signed?: boolean;
  /** Abbreviate (₹7.2L); the full amount stays available as a tooltip. */
  compact?: boolean;
  locale?: string;
  strong?: boolean;
}

const toneColor = (amountMinor: number) =>
  amountMinor > 0
    ? 'var(--acme-color-success-text)'
    : amountMinor < 0
      ? 'var(--acme-color-danger-text)'
      : undefined;

/** Displays integer minor units in their currency, e.g. 324000000 INR -> ₹32,40,000. */
export function MoneyText({
  amountMinor,
  currency,
  signed = false,
  compact = false,
  locale,
  strong = false,
}: MoneyTextProps) {
  const money = { amountMinor, currency };
  return (
    <span
      title={compact ? formatMoney(money, { locale, signed }) : undefined}
      style={{
        fontVariantNumeric: 'tabular-nums',
        whiteSpace: 'nowrap',
        fontWeight: strong ? 600 : undefined,
        color: signed ? toneColor(amountMinor) : undefined,
      }}
    >
      {formatMoney(money, { locale, signed, compact })}
    </span>
  );
}
