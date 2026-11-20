import { toPercent } from './scale';
import styles from './RangeBar.module.css';

export interface RangeBarProps {
  /** Full sentence for screen readers; the bar itself has no text. */
  label: string;
  min: number;
  median: number;
  max: number;
  /** Optional single value to mark on the range. */
  marker?: number;
  /** Shared axis so several bars line up; defaults to this bar's own range. */
  scaleMin?: number;
  scaleMax?: number;
}

/**
 * Min–max range with a median dot and an optional marker. Knows nothing about
 * money: values are any consistent unit and only their positions matter.
 * PayRangeRow wraps it for salaries.
 */
export function RangeBar({
  label,
  min,
  median,
  max,
  marker,
  scaleMin = min,
  scaleMax = max,
}: RangeBarProps) {
  const left = toPercent(min, scaleMin, scaleMax);
  const right = toPercent(max, scaleMin, scaleMax);
  return (
    <div role="img" aria-label={label} className={styles.track}>
      <div className={styles.rail} />
      <div className={styles.range} style={{ left: `${left}%`, width: `${right - left}%` }} />
      <div
        className={styles.median}
        data-testid="range-median"
        style={{ left: `${toPercent(median, scaleMin, scaleMax)}%` }}
      />
      {marker !== undefined && (
        <div
          className={styles.marker}
          data-testid="range-marker"
          style={{ left: `${toPercent(marker, scaleMin, scaleMax)}%` }}
        />
      )}
    </div>
  );
}
