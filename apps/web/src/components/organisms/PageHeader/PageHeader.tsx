import { useLayoutEffect, useRef, type ReactNode } from 'react';
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
 *
 * It publishes its height on its parent as `--acme-page-header-height`, so content that should
 * also stay in view (Import's steps) can stick just below it.
 */
export function PageHeader({ title, description, actions, back }: PageHeaderProps) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const header = ref.current;
    const parent = header?.parentElement;
    if (!header || !parent) return;
    const publish = () =>
      parent.style.setProperty('--acme-page-header-height', `${header.offsetHeight}px`);
    publish();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(publish);
    observer.observe(header);
    return () => {
      observer.disconnect();
      parent.style.removeProperty('--acme-page-header-height');
    };
  }, []);
  return (
    <div ref={ref} className={styles.header}>
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
