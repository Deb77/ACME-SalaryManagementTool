import { IconCheck, IconX } from '@tabler/icons-react';
import styles from './CheckList.module.css';

export interface CheckListItem {
  label: string;
  allowed: boolean;
}

export interface CheckListProps {
  items: readonly CheckListItem[];
  /** Light text and marks for use on the dark hero background. */
  inverted?: boolean;
}

/** What a role allows, as ticks and crosses; each item says "Allowed" or "Not allowed" in words. */
export function CheckList({ items, inverted = false }: CheckListProps) {
  return (
    <ul className={[styles.list, inverted && styles.inverted].filter(Boolean).join(' ')}>
      {items.map((item) => (
        <li key={item.label} className={styles.item} data-allowed={item.allowed}>
          <span className={styles.mark} aria-hidden="true">
            {item.allowed ? <IconCheck size={13} stroke={3} /> : <IconX size={13} stroke={3} />}
          </span>
          <span>
            <span className="visually-hidden">{item.allowed ? 'Allowed: ' : 'Not allowed: '}</span>
            {item.label}
          </span>
        </li>
      ))}
    </ul>
  );
}
