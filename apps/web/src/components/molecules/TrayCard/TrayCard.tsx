import { useId, type ReactNode } from 'react';
import styles from './TrayCard.module.css';

export interface TrayCardProps {
  /** Shown in small caps above the panel; also the section's accessible name. */
  title: ReactNode;
  /** Controls next to the title (segmented filter, search, menu). */
  extra?: ReactNode;
  /** Muted strip under the panel for totals, notes and legends. */
  footer?: ReactNode;
  /** Remove body padding, e.g. when the body is a table. */
  flush?: boolean;
  as?: 'section' | 'aside';
  headingLevel?: 2 | 3;
  className?: string;
  children: ReactNode;
}

/** The grey "tray" around a white panel used for every card in the designs. */
export function TrayCard({
  title,
  extra,
  footer,
  flush = false,
  as: Element = 'section',
  headingLevel = 2,
  className,
  children,
}: TrayCardProps) {
  const titleId = useId();
  const Heading = headingLevel === 2 ? 'h2' : 'h3';
  return (
    <Element
      aria-labelledby={titleId}
      className={[styles.tray, className].filter(Boolean).join(' ')}
    >
      <div className={styles.header}>
        <Heading id={titleId} className={styles.title}>
          {title}
        </Heading>
        {extra}
      </div>
      <div className={[styles.body, flush && styles.flush].filter(Boolean).join(' ')}>
        {children}
      </div>
      {footer !== undefined && <div className={styles.footer}>{footer}</div>}
    </Element>
  );
}
