import { useId, type ReactNode } from 'react';
import { Skeleton } from '../../atoms/Skeleton/Skeleton';
import { CheckList, type CheckListItem } from '../CheckList/CheckList';
import checkStyles from '../CheckList/CheckList.module.css';
import styles from './RoleCard.module.css';

export interface RoleCardProps {
  name: string;
  /** "All countries" or "Only the countries assigned to them". */
  scope: string;
  badge: string;
  permissions: readonly CheckListItem[];
  /** Footer, e.g. "2 people · System role". */
  footer: ReactNode;
  /** The dark green card used for the full-access role. */
  hero?: boolean;
  /** Edit and delete buttons for roles the viewer may manage. */
  actions?: ReactNode;
}

/** One role: name, scope, what it allows and who holds it (Access & roles). */
export function RoleCard({
  name,
  scope,
  badge,
  permissions,
  footer,
  hero = false,
  actions,
}: RoleCardProps) {
  const titleId = useId();
  return (
    <article
      aria-labelledby={titleId}
      className={[styles.card, hero && styles.hero].filter(Boolean).join(' ')}
    >
      <div className={styles.head}>
        <div className={styles.titles}>
          <h3 id={titleId} className={styles.name}>
            {name}
          </h3>
          <div className={styles.scope}>{scope}</div>
        </div>
        <span className={styles.badge}>{badge}</span>
      </div>
      <CheckList items={permissions} inverted={hero} />
      <div className={styles.footer}>
        <span>{footer}</span>
        {actions && <div className={styles.actions}>{actions}</div>}
      </div>
    </article>
  );
}

/**
 * RoleCard while roles load: the real card, heading, badge, check-list and footer boxes with
 * placeholder text, so each line keeps the real line height.
 */
export function RoleCardSkeleton({
  permissionCount,
  withActions = false,
}: {
  permissionCount: number;
  /** Reserve the small Edit button row a manageable role has. */
  withActions?: boolean;
}) {
  return (
    <div className={styles.card} aria-hidden="true">
      <div className={styles.head}>
        <div className={styles.titles}>
          <div className={styles.name}>
            <Skeleton inline width={130} height={16} />
          </div>
          <div className={styles.scope}>
            <Skeleton inline width={170} height={11} />
          </div>
        </div>
        <span className={styles.badge}>
          <Skeleton inline width={60} height={10} />
        </span>
      </div>
      <ul className={checkStyles.list}>
        {Array.from({ length: permissionCount }, (_, index) => (
          <li key={index} className={checkStyles.item} data-allowed="false">
            <span className={checkStyles.mark} />
            <Skeleton inline width={index % 2 ? 150 : 190} height={12} />
          </li>
        ))}
      </ul>
      <div className={styles.footer}>
        <Skeleton inline width={120} height={11} />
        {withActions && (
          <div className={styles.actions}>
            <Skeleton width={64} height={36} pill />
          </div>
        )}
      </div>
    </div>
  );
}
