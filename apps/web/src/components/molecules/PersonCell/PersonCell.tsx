import { initialsOf } from './PersonCell.utils';
import styles from './PersonCell.module.css';

export interface PersonCellProps {
  name: string;
  /** Secondary line, e.g. "ACME-00042 · priya.sharma@acme.com". */
  detail?: string;
  /** Makes the name a link to the person's page. */
  href?: string;
  size?: 'small' | 'medium' | 'large';
}

/** Initials avatar + name + detail, used in tables, dialogs and AI answers. */
export function PersonCell({ name, detail, href, size = 'medium' }: PersonCellProps) {
  return (
    <div className={styles.root}>
      <span aria-hidden="true" className={`${styles.avatar} ${styles[size]}`}>
        {initialsOf(name)}
      </span>
      <div className={styles.text}>
        {href ? (
          <a href={href} className={styles.name}>
            {name}
          </a>
        ) : (
          <div className={styles.name}>{name}</div>
        )}
        {detail && <div className={styles.detail}>{detail}</div>}
      </div>
    </div>
  );
}
