import { IconSparkles } from '@tabler/icons-react';
import type { ReactNode } from 'react';
import styles from './ChatMessage.module.css';

export interface ChatMessageProps {
  from: 'user' | 'assistant';
  children: ReactNode;
}

/** One turn in the Ask AI conversation: the question bubble or the answer. */
export function ChatMessage({ from, children }: ChatMessageProps) {
  if (from === 'user') {
    return (
      <div className={styles.question}>
        <span className="visually-hidden">You asked: </span>
        {children}
      </div>
    );
  }
  return (
    <article aria-label="Assistant answer" className={styles.answer}>
      <span className={styles.avatar} aria-hidden="true">
        <IconSparkles size={16} stroke={1.75} />
      </span>
      <div className={styles.answerBody}>{children}</div>
    </article>
  );
}
