import { useState } from 'react';
import { Logo } from '../components';
import styles from './SplashScreen.module.css';

/** Holds back the fade-in a moment, so a fast load never flashes the splash. */
const FADE_DELAY_MS = 120;

/**
 * The ACME People mark and a loading bar on the frame's grey, while the app works out who is
 * signed in. index.html shows the same splash before any script has loaded; this one starts
 * its animations part-way through, in step with the page clock, so the hand-over is invisible.
 */
export function SplashScreen() {
  const [delay] = useState(() => `${Math.round(FADE_DELAY_MS - performance.now())}ms`);
  return (
    <main className={styles.splash} style={{ animationDelay: delay }} aria-busy="true">
      <Logo size={64} />
      <div className={styles.bar} style={{ animationDelay: delay }} />
      <p className="visually-hidden" role="status">
        Loading ACME People…
      </p>
    </main>
  );
}
