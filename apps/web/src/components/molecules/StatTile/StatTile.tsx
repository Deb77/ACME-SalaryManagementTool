import { useId, type ReactNode } from 'react';
import trayStyles from '../TrayCard/TrayCard.module.css';
import styles from './StatTile.module.css';

export type DeltaTone = 'positive' | 'negative' | 'neutral';

export interface StatTileProps {
  label: string;
  value: ReactNode;
  /** Short emphasised figure in the footer, e.g. "+412" or "+8.4%". */
  delta?: string;
  deltaTone?: DeltaTone;
  /** Text after the delta, e.g. "hired in 2026" (or a Skeleton while it loads). */
  note?: ReactNode;
  /** Decorative mini bar chart; the value and note carry the meaning. */
  trend?: readonly number[];
  /** `hero`: the dark green headline KPI. `warning`: a count that needs attention (rows to fix). */
  variant?: 'default' | 'hero' | 'warning';
}

const MIN_BAR_PX = 6;
const MAX_BAR_PX = 48;

export function StatTile({
  label,
  value,
  delta,
  deltaTone = 'neutral',
  note,
  trend,
  variant = 'default',
}: StatTileProps) {
  const labelId = useId();
  const max = trend && trend.length > 0 ? Math.max(...trend) : 0;
  return (
    <section aria-labelledby={labelId} className={trayStyles.tray}>
      <div
        className={[styles.panel, variant !== 'default' && styles[variant]]
          .filter(Boolean)
          .join(' ')}
      >
        <h2 id={labelId} className={styles.label}>
          {label}
        </h2>
        <div className={styles.row}>
          <div className={styles.value}>{value}</div>
          {trend && max > 0 && (
            <div className={styles.bars} aria-hidden="true" data-testid="stat-trend">
              {trend.map((point, index) => (
                <div
                  key={index}
                  className={styles.bar}
                  style={{ height: Math.max(MIN_BAR_PX, Math.round((point / max) * MAX_BAR_PX)) }}
                />
              ))}
            </div>
          )}
        </div>
      </div>
      {(delta || note) && (
        <div className={styles.footer}>
          {delta && <span className={styles[deltaTone]}>{delta}</span>}
          {delta && note && ' '}
          {note && <span>{note}</span>}
        </div>
      )}
    </section>
  );
}
