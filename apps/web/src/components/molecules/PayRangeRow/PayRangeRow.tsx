import { formatMoney } from '../../../lib/money';
import { MoneyText, RangeBar, Skeleton } from '../../atoms';
import styles from './PayRangeRow.module.css';

export interface PayRangeRowProps {
  /** What the range describes, e.g. a job title. */
  title: string;
  currency: string;
  minMinor: number;
  medianMinor: number;
  maxMinor: number;
  /** One salary to mark on the range, e.g. the employee being viewed. */
  markerMinor?: number;
  /** Shared axis so rows line up; defaults to this row's own range. */
  scaleMinMinor?: number;
  scaleMaxMinor?: number;
}

/**
 * One pay range: title, min–max bar with median dot, and the median amount.
 * Rows share a fixed column layout, so a list of them lines up.
 */
export function PayRangeRow({
  title,
  currency,
  minMinor,
  medianMinor,
  maxMinor,
  markerMinor,
  scaleMinMinor,
  scaleMaxMinor,
}: PayRangeRowProps) {
  const short = (amountMinor: number) => formatMoney({ amountMinor, currency }, { compact: true });
  const marker = markerMinor === undefined ? '' : `, this employee ${short(markerMinor)}`;
  const label = `${title}: ${short(minMinor)} to ${short(maxMinor)}, median ${short(medianMinor)}${marker}`;

  return (
    <div className={styles.row}>
      <span className={styles.title}>{title}</span>
      <RangeBar
        label={label}
        min={minMinor}
        median={medianMinor}
        max={maxMinor}
        marker={markerMinor}
        scaleMin={scaleMinMinor}
        scaleMax={scaleMaxMinor}
      />
      <span className={styles.median}>
        <MoneyText amountMinor={medianMinor} currency={currency} compact strong />
      </span>
    </div>
  );
}

/** PayRangeRow while its numbers load: same grid, title, 16px bar and median slots. */
export function PayRangeRowSkeleton({
  title,
  titleWidth = '70%',
}: {
  /** A title that is known before the numbers, e.g. "Pay range". */
  title?: string;
  titleWidth?: string;
}) {
  return (
    <div className={styles.row} aria-hidden="true">
      <span className={styles.title}>
        {title ?? <Skeleton inline width={titleWidth} height={14} />}
      </span>
      <Skeleton height={16} pill />
      <span className={styles.median}>
        <Skeleton inline width={52} height={14} />
      </span>
    </div>
  );
}
