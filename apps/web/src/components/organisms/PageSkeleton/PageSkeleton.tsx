import { useEffect, useState, type ReactNode } from 'react';
import { Skeleton } from '../../atoms/Skeleton/Skeleton';
import { LoadingState, type LoadingShape } from '../../molecules/LoadingState/LoadingState';
import styles from './PageSkeleton.module.css';

export type PageSkeletonVariant = 'list' | 'detail' | 'form' | 'dashboard' | 'cards';

export interface PageSkeletonProps {
  /** Which screen layout to sketch, so the page doesn't jump when the data arrives. */
  variant?: PageSkeletonVariant;
  /** What is loading, read out to screen readers. */
  label?: string;
  /** Fast loads draw nothing for this long (see LoadingState). */
  delayMs?: number;
  /**
   * A screen's own skeleton (its real PageHeader, cards and grids with Skeleton values).
   * Replaces the generic `variant` sketch and lays out like the screen itself.
   */
  children?: ReactNode;
}

function Tray({
  shape,
  rows,
  children,
}: {
  shape?: LoadingShape;
  rows?: number;
  children?: ReactNode;
}) {
  return (
    <div className={styles.tray}>
      <div className={styles.trayHeader}>
        <Skeleton width={140} height={12} />
      </div>
      <div className={styles.trayBody}>
        {children ?? <LoadingState shape={shape} rows={rows} delayMs={0} label="" />}
      </div>
    </div>
  );
}

function Fields({ count }: { count: number }) {
  return (
    <div className={styles.fields}>
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className={styles.field}>
          <Skeleton width={96} height={12} />
          <Skeleton height={48} />
        </div>
      ))}
    </div>
  );
}

function Body({ variant }: { variant: PageSkeletonVariant }) {
  switch (variant) {
    case 'detail':
      return (
        <div className={styles.columns}>
          <Tray shape="lines" rows={5} />
          <Tray shape="list" rows={2} />
          <div className={styles.full}>
            <Tray shape="table" rows={4} />
          </div>
        </div>
      );
    case 'form':
      return (
        <div className={styles.stack}>
          <Tray>
            <Fields count={3} />
          </Tray>
          <Tray>
            <Fields count={4} />
          </Tray>
        </div>
      );
    case 'dashboard':
      return (
        <div className={styles.stack}>
          <div className={styles.tiles}>
            {Array.from({ length: 4 }, (_, index) => (
              <div key={index} className={styles.tile}>
                <Skeleton width="50%" height={12} />
                <Skeleton width="70%" height={28} />
              </div>
            ))}
          </div>
          <div className={styles.columns}>
            <Tray shape="list" rows={5} />
            <Tray shape="chart" />
          </div>
        </div>
      );
    case 'cards':
      return (
        <div className={styles.stack}>
          <div className={styles.cards}>
            {Array.from({ length: 3 }, (_, index) => (
              <div key={index} className={styles.tile}>
                <Skeleton width="45%" height={16} />
                <Skeleton width="30%" height={12} />
                <Skeleton width="80%" />
                <Skeleton width="65%" />
              </div>
            ))}
          </div>
          <Tray shape="table" rows={4} />
        </div>
      );
    case 'list':
    default:
      return (
        <div className={styles.stack}>
          <div className={styles.toolbar}>
            <Skeleton height={44} pill className={styles.search} />
            <Skeleton width={120} height={44} pill />
            <Skeleton width={120} height={44} pill />
          </div>
          <Tray shape="table" rows={8} />
        </div>
      );
  }
}

/**
 * One loading period often mounts several skeletons in a row: the boot frame, the route's code
 * download, then the screen's own while its data loads. They share one delay, counted from the
 * first, so a later one doesn't blank the page for another `delayMs` after the last was drawn.
 */
const HANDOFF_MS = 100;
let mountedCount = 0;
let chainStart = 0;
let chainEnd = Number.NEGATIVE_INFINITY;

function remainingDelay(delayMs: number) {
  const now = Date.now();
  const handoff = mountedCount > 0 || now - chainEnd < HANDOFF_MS;
  if (!handoff) chainStart = now;
  return Math.max(0, chainStart + delayMs - now);
}

/**
 * A whole screen as skeletons: page title, actions and cards in the screen's own layout.
 * Used while a screen's first data loads and while its code chunk downloads.
 */
export function PageSkeleton({
  variant = 'list',
  label = 'Loading…',
  delayMs = 150,
  children,
}: PageSkeletonProps) {
  const [wait] = useState(() => remainingDelay(delayMs));
  const [visible, setVisible] = useState(wait <= 0);
  useEffect(() => {
    mountedCount += 1;
    return () => {
      mountedCount -= 1;
      if (mountedCount === 0) chainEnd = Date.now();
    };
  }, []);
  useEffect(() => {
    if (wait <= 0) return;
    const timer = setTimeout(() => setVisible(true), wait);
    return () => clearTimeout(timer);
  }, [wait]);

  if (children) {
    return (
      <div role="status" aria-live="polite" aria-busy="true" className={styles.screen}>
        <span className={styles.label}>{label}</span>
        {visible && children}
      </div>
    );
  }

  return (
    <div role="status" aria-live="polite" aria-busy="true" className={styles.root}>
      <span className={styles.label}>{label}</span>
      {visible && (
        <div className={styles.page} aria-hidden="true">
          <div className={styles.header}>
            <div className={styles.heading}>
              <Skeleton width={220} height={30} />
              <Skeleton width={160} height={14} />
            </div>
            <div className={styles.actions}>
              <Skeleton width={130} height={44} pill />
              <Skeleton width={150} height={44} pill />
            </div>
          </div>
          <Body variant={variant} />
        </div>
      )}
    </div>
  );
}
