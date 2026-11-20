import { Loader } from '@mantine/core';
import styles from './LoadingState.module.css';

export interface LoadingStateProps {
  /** What is loading, read out to screen readers. */
  label?: string;
  minHeight?: number;
}

export function LoadingState({ label = 'Loading…', minHeight = 160 }: LoadingStateProps) {
  return (
    <div role="status" aria-live="polite" className={styles.root} style={{ minHeight }}>
      <Loader size="sm" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}
