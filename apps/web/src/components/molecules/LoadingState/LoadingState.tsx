import { useEffect, useState } from 'react';
import { Skeleton } from '../../atoms/Skeleton/Skeleton';
import styles from './LoadingState.module.css';

export type LoadingShape = 'lines' | 'table' | 'list' | 'chart' | 'answer';

export interface LoadingStateProps {
  /** What is loading, read out to screen readers. */
  label?: string;
  /** The layout of the content that will replace the skeleton, so nothing jumps when it arrives. */
  shape?: LoadingShape;
  /** Rows for `table` and `list`, lines for `lines` and `answer`. */
  rows?: number;
  minHeight?: number;
  /**
   * Fast responses never show the skeleton: for this long only the reserved space is drawn,
   * which avoids a flash on quick loads.
   */
  delayMs?: number;
}

const LINE_WIDTHS = ['92%', '78%', '64%', '86%', '52%'];
const BAR_HEIGHTS = [34, 62, 88, 70, 48, 30, 22, 16];

function Bones({ shape, rows }: { shape: LoadingShape; rows: number }) {
  switch (shape) {
    case 'table':
      return (
        <div className={styles.table}>
          <div className={styles.tableHead}>
            <Skeleton width="28%" height={10} />
            <Skeleton width="18%" height={10} />
            <Skeleton width="14%" height={10} />
          </div>
          {Array.from({ length: rows }, (_, index) => (
            <div key={index} className={styles.tableRow}>
              <Skeleton circle height={32} />
              <div className={styles.grow}>
                <Skeleton width={index % 2 ? '55%' : '68%'} />
                <Skeleton width="40%" height={11} />
              </div>
              <Skeleton width={88} className={styles.end} />
            </div>
          ))}
        </div>
      );
    case 'list':
      return (
        <div className={styles.list}>
          {Array.from({ length: rows }, (_, index) => (
            <div key={index} className={styles.listRow}>
              <Skeleton width={index % 2 ? '46%' : '58%'} />
              <Skeleton height={8} pill />
            </div>
          ))}
        </div>
      );
    case 'chart':
      return (
        <div className={styles.chart}>
          {BAR_HEIGHTS.map((height, index) => (
            <Skeleton key={index} height={`${height}%`} className={styles.bar} />
          ))}
        </div>
      );
    case 'answer':
    case 'lines':
    default:
      return (
        <div className={styles.lines}>
          {Array.from({ length: rows }, (_, index) => (
            <Skeleton key={index} width={LINE_WIDTHS[index % LINE_WIDTHS.length]} />
          ))}
        </div>
      );
  }
}

const DEFAULT_ROWS: Record<LoadingShape, number> = {
  lines: 3,
  answer: 3,
  table: 5,
  list: 4,
  chart: 0,
};

const DEFAULT_HEIGHT: Record<LoadingShape, number> = {
  lines: 96,
  answer: 72,
  table: 320,
  list: 200,
  chart: 240,
};

/** Skeleton placeholder for one async card or section, shaped like what will replace it. */
export function LoadingState({
  label = 'Loading…',
  shape = 'lines',
  rows,
  minHeight,
  delayMs = 150,
}: LoadingStateProps) {
  const [visible, setVisible] = useState(delayMs <= 0);
  useEffect(() => {
    if (delayMs <= 0) return;
    const timer = setTimeout(() => setVisible(true), delayMs);
    return () => clearTimeout(timer);
  }, [delayMs]);

  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className={styles.root}
      style={{ minHeight: minHeight ?? DEFAULT_HEIGHT[shape] }}
    >
      <span className={styles.label}>{label}</span>
      {visible && <Bones shape={shape} rows={rows ?? DEFAULT_ROWS[shape]} />}
    </div>
  );
}
