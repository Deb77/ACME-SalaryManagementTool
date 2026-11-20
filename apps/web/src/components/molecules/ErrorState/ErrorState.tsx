import { IconAlertTriangle } from '@tabler/icons-react';
import type { ReactNode } from 'react';
import { PillButton } from '../../atoms/PillButton/PillButton';
import styles from './ErrorState.module.css';

export interface ErrorStateProps {
  title?: string;
  /** What failed in plain words; never a stack trace. */
  description?: ReactNode;
  onRetry?: () => void;
  retryLabel?: string;
}

/** Inline failure message for a card or page, announced to screen readers. */
export function ErrorState({
  title = 'Something went wrong',
  description = 'We could not load this. Check your connection and try again.',
  onRetry,
  retryLabel = 'Try again',
}: ErrorStateProps) {
  return (
    <div role="alert" className={styles.root}>
      <IconAlertTriangle aria-hidden="true" className={styles.icon} size={32} stroke={1.5} />
      <strong className={styles.title}>{title}</strong>
      <span className={styles.description}>{description}</span>
      {onRetry && (
        <div className={styles.action}>
          <PillButton onClick={onRetry}>{retryLabel}</PillButton>
        </div>
      )}
    </div>
  );
}
