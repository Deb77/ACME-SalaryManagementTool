import type { ReactNode } from 'react';
import styles from './StatusTag.module.css';

export type StatusTone = 'success' | 'neutral' | 'warning' | 'danger' | 'info';

export interface StatusTagProps {
  tone?: StatusTone;
  /** Leading dot, used for live states such as "Active". */
  dot?: boolean;
  children: ReactNode;
}

/**
 * Pill tag for statuses (Active, Terminated), salary-change reasons and roles.
 * The text always states the status; colour is a secondary cue.
 */
export function StatusTag({ tone = 'neutral', dot = false, children }: StatusTagProps) {
  return (
    <span className={`${styles.tag} ${styles[tone]}`}>
      {dot && <span aria-hidden="true" className={styles.dot} />}
      {children}
    </span>
  );
}
