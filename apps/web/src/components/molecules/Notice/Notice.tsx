import { IconAlertTriangle, IconInfoCircle, IconSparkles } from '@tabler/icons-react';
import { useId, type ReactNode } from 'react';
import styles from './Notice.module.css';

export type NoticeTone = 'info' | 'warning' | 'accent';

export interface NoticeProps {
  tone?: NoticeTone;
  /** Bold first line; the notice is named by it. */
  title?: ReactNode;
  children?: ReactNode;
  /** Usually one PillButton, e.g. "Review drafts". */
  action?: ReactNode;
}

const ICONS = { info: IconInfoCircle, warning: IconAlertTriangle, accent: IconSparkles };

/**
 * A callout inside a page: scope reminders ("You can import India only"), AI caveats and the
 * Ask AI approval card (`accent` tone with an action). Not live: use ErrorState for failures.
 */
export function Notice({ tone = 'info', title, children, action }: NoticeProps) {
  const titleId = useId();
  const Icon = ICONS[tone];
  return (
    <section
      aria-labelledby={title ? titleId : undefined}
      aria-label={title ? undefined : 'Note'}
      className={`${styles.root} ${styles[tone]}`}
    >
      <Icon aria-hidden="true" className={styles.icon} size={20} stroke={1.75} />
      <div className={styles.body}>
        {title && (
          <h3 id={titleId} className={styles.title}>
            {title}
          </h3>
        )}
        {children && <div className={styles.text}>{children}</div>}
      </div>
      {action && <div className={styles.action}>{action}</div>}
    </section>
  );
}
