import { useEffect, useMemo, useState } from 'react';
import styles from './Confetti.module.css';

export interface ConfettiProps {
  /** How many pieces fall. */
  pieces?: number;
  /** How long the burst stays on screen, in milliseconds; it removes itself afterwards. */
  durationMs?: number;
}

const COLOURS = [
  'var(--acme-color-accent)',
  'var(--acme-color-green300)',
  'var(--acme-color-warning)',
  '#5B8DEF',
  '#E06C9F',
  '#F2C14E',
];

/** A scatter that looks random but is the same on every render: 0 ≤ n < 1 for piece and salt. */
function scatter(index: number, salt: number) {
  const x = Math.sin(index * 12.9898 + salt * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

function prefersReducedMotion() {
  return typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
    : false;
}

/**
 * A one-off burst of confetti over the page, for a finished job worth celebrating. Purely
 * decorative: hidden from assistive technology, never blocks clicks, and skipped entirely for
 * people who ask for reduced motion.
 */
export function Confetti({ pieces = 90, durationMs = 4200 }: ConfettiProps) {
  const [visible, setVisible] = useState(() => !prefersReducedMotion());

  useEffect(() => {
    if (!visible) return;
    const timer = window.setTimeout(() => setVisible(false), durationMs);
    return () => window.clearTimeout(timer);
  }, [visible, durationMs]);

  const confetti = useMemo(
    () =>
      Array.from({ length: pieces }, (_, index) => ({
        left: `${scatter(index, 1) * 100}%`,
        colour: COLOURS[index % COLOURS.length],
        delay: `${Math.round(scatter(index, 2) * 700)}ms`,
        fall: `${Math.round(2200 + scatter(index, 3) * 1600)}ms`,
        drift: `${Math.round(scatter(index, 4) * 160 - 80)}px`,
        spin: `${Math.round(360 + scatter(index, 5) * 720)}deg`,
        wide: index % 3 === 0,
      })),
    [pieces],
  );

  if (!visible) return null;
  return (
    <div className={styles.root} aria-hidden="true" data-testid="confetti">
      {confetti.map((piece, index) => (
        <span
          key={index}
          className={`${styles.piece} ${piece.wide ? styles.wide : ''}`}
          style={
            {
              left: piece.left,
              background: piece.colour,
              animationDelay: piece.delay,
              animationDuration: piece.fall,
              '--drift': piece.drift,
              '--spin': piece.spin,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
}
