import type { ReactNode } from 'react';
import styles from './KeyValueList.module.css';

export interface KeyValueItem {
  label: string;
  value: ReactNode;
}

export interface KeyValueListProps {
  items: readonly KeyValueItem[];
  /** `grid` puts two pairs per row from tablet width up; `rows` keeps one pair per row. */
  layout?: 'rows' | 'grid';
}

/** A description list of label/value pairs (employee profile, "India at a glance"). */
export function KeyValueList({ items, layout = 'rows' }: KeyValueListProps) {
  return (
    <dl className={`${styles.list} ${styles[layout]}`}>
      {items.map((item) => (
        <div key={item.label} className={styles.pair}>
          <dt className={styles.label}>{item.label}</dt>
          <dd className={styles.value}>{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}
