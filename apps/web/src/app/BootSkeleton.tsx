import { useLocation } from 'react-router';
import { AppShell } from '../components';
import { activeKeyFor, homePathFor, navGroupsFor } from './navigation';
import { RouteSkeleton } from './RouteSkeleton';

const everything = () => true;

/**
 * First page load, before the session arrives: the real app frame and the route's own
 * skeleton, so nothing moves when the app appears. Until the user is known it assumes the
 * common case, a user who can see every section.
 */
export function BootSkeleton() {
  const { pathname } = useLocation();
  const path = pathname === '/' ? (homePathFor(everything) ?? pathname) : pathname;
  return (
    <AppShell
      productName="ACME People"
      logo="A"
      navGroups={navGroupsFor(everything)}
      activeKey={activeKeyFor(path)}
      user={null}
    >
      <RouteSkeleton pathname={path} />
    </AppShell>
  );
}
