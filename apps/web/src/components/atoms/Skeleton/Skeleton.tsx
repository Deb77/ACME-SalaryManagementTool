import { useState, type CSSProperties } from 'react';
import styles from './Skeleton.module.css';

export interface SkeletonProps {
  /** CSS width, e.g. `120` (px) or `'60%'`. Defaults to the full width. */
  width?: number | string;
  /** CSS height; defaults to one line of body text. */
  height?: number | string;
  /** Round, for avatars. Uses `height` as the diameter. */
  circle?: boolean;
  /** Pill-shaped, for buttons and tags. */
  pill?: boolean;
  /**
   * Sit on a line of text (inline-block, vertically centred) so the line keeps the height
   * of the real text: use inside headings, paragraphs and table cells.
   */
  inline?: boolean;
  className?: string;
}

/** Matches the `shimmer` animation's duration in Skeleton.module.css. */
const SHIMMER_MS = 1400;

/**
 * Starts the shimmer part-way through, in step with the page clock, so every placeholder sweeps
 * together and a skeleton that replaces another (the route's, then the screen's own while its
 * data loads) carries on instead of restarting, which read as the page loading twice.
 */
function useShimmerPhase(): string {
  const [delay] = useState(() => `${-Math.round(performance.now() % SHIMMER_MS)}ms`);
  return delay;
}

const size = (value: number | string | undefined) =>
  typeof value === 'number' ? `${value}px` : value;

/**
 * A grey placeholder in the shape of content that is still loading. Decorative only:
 * the surrounding LoadingState or PageSkeleton announces the loading state.
 */
export function Skeleton({ width, height = 14, circle, pill, inline, className }: SkeletonProps) {
  const animationDelay = useShimmerPhase();
  const style: CSSProperties = {
    width: size(circle ? height : (width ?? '100%')),
    height: size(height),
    animationDelay,
  };
  const shape = circle ? styles.circle : pill ? styles.pill : undefined;
  const bone = (
    <span
      aria-hidden="true"
      data-skeleton=""
      className={[styles.bone, shape, inline && styles.inline, inline ? undefined : className]
        .filter(Boolean)
        .join(' ')}
      style={style}
    />
  );
  // The wrapper is a line of text even when a flex or grid parent blockifies it, so the
  // placeholder always takes the height of the text it stands in for.
  return inline ? (
    <span aria-hidden="true" className={[styles.line, className].filter(Boolean).join(' ')}>
      {bone}
    </span>
  ) : (
    bone
  );
}
