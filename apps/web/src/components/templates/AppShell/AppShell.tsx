import type { ReactNode } from 'react';
import { AppLink } from '../../atoms/AppLink/AppLink';
import { Skeleton } from '../../atoms/Skeleton/Skeleton';
import { initialsOf } from '../../molecules/PersonCell/PersonCell.utils';
import styles from './AppShell.module.css';

export interface NavItem {
  key: string;
  label: string;
  href: string;
  icon?: ReactNode;
  /** Label in the phone tab bar when `label` is too long, e.g. "Access" for "Access & roles". */
  shortLabel?: string;
  /** Only in the desktop navigation, never a phone tab (e.g. Help, which phones reach via `phoneActions`). */
  desktopOnly?: boolean;
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
  /** Who is signed in; `null` while that is still loading (drawn as placeholders). */
  user: { name: string; role: string } | null;
  /** Left side of the top bar: breadcrumb or page context. */
  topBarStart?: ReactNode;
  /** Right side of the top bar: global actions. */
  topBarEnd?: ReactNode;
  /** Account action next to the user (e.g. a sign-out IconButton): nav on desktop, top bar on phones. */
  userAction?: ReactNode;
  /** Extra top-bar actions on phones and tablets, e.g. a link that is a desktop-only nav item. */
  phoneActions?: ReactNode;
  children: ReactNode;
}

/**
 * Page frame from the designs, mobile first. On phones and tablets: a sticky top bar (logo,
 * page context, account) and the main navigation as a bottom tab bar. From desktop width
 * (1024px): the grey frame with the left navigation grouped by area and a white rounded
 * panel. It is one `<nav>` restyled by CSS, so assistive technology always finds one
 * "Main" navigation. Links go through AppLink, so the app's router handles them.
 */
export function AppShell({
  productName,
  logo,
  navGroups,
  activeKey,
  user,
  topBarStart,
  topBarEnd,
  userAction,
  phoneActions,
  children,
}: AppShellProps) {
  const logoMark = logo && (
    <span className={styles.logo} aria-hidden="true">
      {logo}
    </span>
  );
  return (
    <div className={styles.frame}>
      <a href="#main-content" className={styles.skip}>
        Skip to content
      </a>
      <nav aria-label="Main" className={styles.nav}>
        <div className={styles.brand}>
          {logoMark}
          {productName}
        </div>
        {navGroups.map((group) => (
          <div
            key={group.label}
            className={
              group.items.every((item) => item.desktopOnly)
                ? `${styles.groupBlock} ${styles.desktopOnly}`
                : styles.groupBlock
            }
          >
            <div className={styles.groupLabel} id={`nav-${group.label}`}>
              {group.label}
            </div>
            <ul
              className={styles.group}
              aria-labelledby={`nav-${group.label}`}
              style={{ flexGrow: group.items.filter((item) => !item.desktopOnly).length }}
            >
              {group.items.map((item) => (
                <li
                  key={item.key}
                  className={
                    item.desktopOnly ? `${styles.item} ${styles.desktopOnly}` : styles.item
                  }
                >
                  <AppLink
                    href={item.href}
                    className={item.shortLabel ? `${styles.link} ${styles.hasShort}` : styles.link}
                    aria-current={item.key === activeKey ? 'page' : undefined}
                    aria-label={item.shortLabel ? item.label : undefined}
                  >
                    {item.icon && (
                      <span className={styles.icon} aria-hidden="true">
                        {item.icon}
                      </span>
                    )}
                    <span className={styles.fullLabel}>{item.label}</span>
                    {item.shortLabel && (
                      <span className={styles.shortLabel} aria-hidden="true">
                        {item.shortLabel}
                      </span>
                    )}
                  </AppLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
        <div className={styles.spacer} />
        <div className={styles.user}>
          <span aria-hidden="true" className={styles.avatar}>
            {user && initialsOf(user.name)}
          </span>
          <div>
            <div className={styles.userName}>
              {user ? user.name : <Skeleton inline width={96} height={12} />}
            </div>
            <div className={styles.userRole}>
              {user ? user.role : <Skeleton inline width={64} height={11} />}
            </div>
          </div>
          {userAction && <div className={styles.userAction}>{userAction}</div>}
        </div>
      </nav>
      <div className={styles.panel}>
        {/* Without top-bar content the bar only exists for the phone logo and avatar; desktop hides it. */}
        <header
          className={`${styles.topBar} ${topBarStart || topBarEnd ? '' : styles.phoneOnly}`}
          data-phone-only={topBarStart || topBarEnd ? undefined : ''}
        >
          <span className={styles.phoneLogo}>{logoMark}</span>
          <div className={styles.topBarStart}>{topBarStart}</div>
          <div className={styles.topBarEnd}>
            {topBarEnd}
            {phoneActions && <span className={styles.phoneOnly}>{phoneActions}</span>}
            {userAction && <span className={styles.phoneOnly}>{userAction}</span>}
            {user ? (
              <span
                role="img"
                aria-label={`Signed in as ${user.name}, ${user.role}`}
                className={`${styles.avatar} ${styles.phoneAvatar}`}
              >
                <span aria-hidden="true">{initialsOf(user.name)}</span>
              </span>
            ) : (
              <span aria-hidden="true" className={`${styles.avatar} ${styles.phoneAvatar}`} />
            )}
          </div>
        </header>
        <main id="main-content" tabIndex={-1} className={styles.main}>
          {children}
        </main>
      </div>
    </div>
  );
}
