import type { ReactNode } from 'react';
import { initialsOf } from '../../molecules/PersonCell/initials';
import styles from './AppShell.module.css';

export interface NavItem {
  key: string;
  label: string;
  href: string;
  icon?: ReactNode;
}

export interface NavGroup {
  label: string;
  items: readonly NavItem[];
}

export interface AppShellProps {
  productName: string;
  logo?: ReactNode;
  navGroups: readonly NavGroup[];
  activeKey: string;
  user: { name: string; role: string };
  /** Left side of the top bar: breadcrumb or page context. */
  topBarStart?: ReactNode;
  /** Right side of the top bar: global search and similar. */
  topBarEnd?: ReactNode;
  children: ReactNode;
}

/**
 * Page frame from the designs: grey frame, left navigation grouped by area,
 * and a white rounded panel with a top bar. The nav wraps above the panel on
 * narrow screens. Navigation is plain links so it works before a router exists.
 */
export function AppShell({
  productName,
  logo,
  navGroups,
  activeKey,
  user,
  topBarStart,
  topBarEnd,
  children,
}: AppShellProps) {
  return (
    <div className={styles.frame}>
      <a href="#main-content" className={styles.skip}>
        Skip to content
      </a>
      <nav aria-label="Main" className={styles.nav}>
        <div className={styles.brand}>
          {logo && (
            <span className={styles.logo} aria-hidden="true">
              {logo}
            </span>
          )}
          {productName}
        </div>
        {navGroups.map((group) => (
          <div key={group.label}>
            <div className={styles.groupLabel} id={`nav-${group.label}`}>
              {group.label}
            </div>
            <ul className={styles.group} aria-labelledby={`nav-${group.label}`}>
              {group.items.map((item) => (
                <li key={item.key}>
                  <a
                    href={item.href}
                    className={styles.link}
                    aria-current={item.key === activeKey ? 'page' : undefined}
                  >
                    {item.icon && <span aria-hidden="true">{item.icon}</span>}
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ))}
        <div className={styles.spacer} />
        <div className={styles.user}>
          <span aria-hidden="true" className={styles.avatar}>
            {initialsOf(user.name)}
          </span>
          <div>
            <div className={styles.userName}>{user.name}</div>
            <div className={styles.userRole}>{user.role}</div>
          </div>
        </div>
      </nav>
      <div className={styles.panel}>
        <header className={styles.topBar}>
          <div>{topBarStart}</div>
          <div>{topBarEnd}</div>
        </header>
        <main id="main-content" tabIndex={-1} className={styles.main}>
          {children}
        </main>
      </div>
    </div>
  );
}
