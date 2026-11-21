import { useLocation } from 'react-router';
import { AppShell } from '../components';
import { activeKeyFor, homePathFor, navGroupsFor } from './navigation';
import signIn from '../screens/SignIn/SignIn.module.css';
import { wasSignedIn } from '../session/signedIn';
import { RouteSkeleton } from './RouteSkeleton';

const everything = () => true;

/**
 * First page load, before the session arrives. Someone who signed in on this browser gets the
 * real app frame and the route's own skeleton, so nothing moves when the app appears; until the
 * user is known it assumes a user who can see every section. Anyone else gets the sign-in
 * page's empty backdrop, so a signed-out visitor never glimpses the app before the form.
 */
export function BootSkeleton() {
  const { pathname } = useLocation();
  if (!wasSignedIn()) return <main className={signIn.page} aria-busy="true" />;
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
