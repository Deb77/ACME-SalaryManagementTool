import { toPercent } from '../RangeBar/RangeBar.utils';
import styles from './MeterBar.module.css';

export interface MeterBarProps {
  value: number;
  max: number;
}

/**
 * Decorative horizontal fill bar (payroll share per country). Hidden from assistive
 * technology: the number next to it carries the meaning.
 */
export function MeterBar({ value, max }: MeterBarProps) {
  return (
    <div className={styles.track} aria-hidden="true">
      <div
        className={styles.fill}
        data-testid="meter-fill"
        style={{ width: `${toPercent(value, 0, max)}%` }}
      />
    </div>
  );
}
