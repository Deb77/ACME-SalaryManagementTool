import type { ReactNode } from 'react';
import styles from './PageHeader.module.css';

export interface PageHeaderProps {
  title: ReactNode;
  description?: ReactNode;
  /** Page-level buttons, primary action last. */
  actions?: ReactNode;
  /** A back link above the title; it stays with the header when the page scrolls. */
  back?: ReactNode;
}

/**
 * Title row of a screen. From desktop width it sticks to the top of the app's scrolling
 * area, so the title and page actions stay in view while the cards below scroll.
 */
export function PageHeader({ title, description, actions, back }: PageHeaderProps) {
  return (
    <div className={styles.header}>
      {back && <div className={styles.back}>{back}</div>}
      <div className={styles.row}>
        <div>
          <h1 className={styles.title}>{title}</h1>
          {description && <p className={styles.description}>{description}</p>}
        </div>
        {actions && <div className={styles.actions}>{actions}</div>}
      </div>
    </div>
  );
}
