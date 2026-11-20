import { IconInbox } from '@tabler/icons-react';
import type { ReactNode } from 'react';
import styles from './EmptyState.module.css';

export interface EmptyStateProps {
  title: string;
  description?: ReactNode;
  /** Usually one PillButton, e.g. "Clear filters" or "Add employee". */
  action?: ReactNode;
}

/** Shown when a list or chart has nothing to display; says why and what to do next. */
export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div className={styles.root}>
      <IconInbox aria-hidden="true" className={styles.icon} size={32} stroke={1.5} />
      <strong className={styles.title}>{title}</strong>
      {description && <span className={styles.description}>{description}</span>}
      {action && <div className={styles.action}>{action}</div>}
    </div>
  );
}
