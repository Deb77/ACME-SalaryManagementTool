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
 * RoleCard while roles load: the real card, heading, badge and footer boxes with placeholder
 * text. Every role lists the same permissions, so their real labels are shown (each line wraps
 * as it will); only whether each is allowed is still unknown.
 */
export function RoleCardSkeleton({
  permissions,
  actions,
  hero = false,
}: {
  /** The labels of every permission, in the order the cards list them. */
  permissions: readonly string[];
  /** The Global HR card's dark style, so it doesn't change colour when the data arrives. */
  hero?: boolean;
  /** The role's buttons, so the footer keeps their height (44px touch targets on phones). */
  actions?: ReactNode;
}) {
  return (
    <div
      className={[styles.card, hero && styles.hero].filter(Boolean).join(' ')}
      aria-hidden="true"
    >
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
      <ul className={[checkStyles.list, hero && checkStyles.inverted].filter(Boolean).join(' ')}>
        {permissions.map((label) => (
          <li key={label} className={checkStyles.item} data-allowed="false">
            <span className={checkStyles.mark} />
            {label}
          </li>
        ))}
      </ul>
      <div className={styles.footer}>
        <Skeleton inline width={120} height={11} />
        {actions && <div className={styles.actions}>{actions}</div>}
      </div>
    </div>
  );
}
