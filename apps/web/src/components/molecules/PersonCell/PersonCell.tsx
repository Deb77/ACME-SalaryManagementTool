import { AppLink } from '../../atoms/AppLink/AppLink';
import { initialsOf } from './PersonCell.utils';
import { Skeleton } from '../../atoms/Skeleton/Skeleton';
import styles from './PersonCell.module.css';

export interface PersonCellProps {
  name: string;
  /** Secondary line, e.g. "ACME-00042 · priya.sharma@acme.com". */
  detail?: string;
  /** Makes the name a link to the person's page. */
  href?: string;
  size?: 'small' | 'medium' | 'large';
  /**
   * Let the detail wrap instead of ending in "…": for dialogs and headers, where there is room
   * below. Table cells keep one line (the full text is in the title).
   */
  wrapDetail?: boolean;
}

/** Initials avatar + name + detail, used in tables, dialogs and AI answers. */
export function PersonCell({
  name,
  detail,
  href,
  size = 'medium',
  wrapDetail = false,
}: PersonCellProps) {
  return (
    <div className={styles.root}>
      <span aria-hidden="true" className={`${styles.avatar} ${styles[size]}`}>
        {initialsOf(name)}
      </span>
      <div className={styles.text}>
        {href ? (
          <AppLink href={href} className={styles.name}>
            {name}
          </AppLink>
        ) : (
          <div className={styles.name}>{name}</div>
        )}
        {detail && (
          <div
            className={wrapDetail ? `${styles.detail} ${styles.wrap}` : styles.detail}
            title={wrapDetail ? undefined : detail}
          >
            {detail}
          </div>
        )}
      </div>
    </div>
  );
}

/** PersonCell while it loads: same avatar size, a name line and a detail line. */
export function PersonCellSkeleton({
  size = 'medium',
  nameWidth = 120,
  detailWidth = 200,
}: {
  size?: PersonCellProps['size'];
  nameWidth?: number | string;
  detailWidth?: number | string;
}) {
  return (
    <div className={styles.root} aria-hidden="true">
      <span className={`${styles.avatar} ${styles[size]}`} />
      <div className={styles.text}>
        <div className={styles.name}>
          <Skeleton inline width={nameWidth} height={12} />
        </div>
        <div className={styles.detail}>
          <Skeleton inline width={detailWidth} height={11} />
        </div>
      </div>
    </div>
  );
}
