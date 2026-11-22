import { useLocation } from 'react-router';
import { AppShell, Logo } from '../components';
import { activeKeyFor, homePathFor, navGroupsFor } from './navigation';
import { wasSignedIn } from '../session/signedIn';
import { RouteSkeleton } from './RouteSkeleton';
import { SplashScreen } from './SplashScreen';

const everything = () => true;

/**
 * First page load, before the session arrives. Someone who signed in on this browser gets the
 * real app frame and the route's own skeleton, so nothing moves when the app appears; until the
 * user is known it assumes a user who can see every section. Anyone else gets the
 * splash, so a signed-out visitor never glimpses the app before the form.
 */
export function BootSkeleton() {
  const { pathname } = useLocation();
  if (!wasSignedIn()) return <SplashScreen />;
  const path = pathname === '/' ? (homePathFor(everything) ?? pathname) : pathname;
  return (
    <AppShell
      productName="ACME People"
      logo={<Logo />}
      navGroups={navGroupsFor(everything)}
      activeKey={activeKeyFor(path)}
      user={null}
    >
      <RouteSkeleton pathname={path} />
    </AppShell>
  );
}
