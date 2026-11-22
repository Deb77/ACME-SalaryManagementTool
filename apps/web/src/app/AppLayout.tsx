import { IconHelpCircle, IconLogout } from '@tabler/icons-react';
import { Suspense, useState } from 'react';
import { Outlet, useLocation } from 'react-router';
import { AppShell, ErrorBoundary, ErrorState, IconButton, Logo } from '../components';
import { useSession } from '../session/SessionContext';
import { activeKeyFor, navGroupsFor } from './navigation';
import { RouteSkeleton } from './RouteSkeleton';

/** The signed-in frame: AppShell with permission-filtered navigation around the routes. */
export function AppLayout() {
  const { me, can, signOut } = useSession();
  const { pathname } = useLocation();
  const [signOutFailed, setSignOutFailed] = useState(false);
  const endSession = () => {
    setSignOutFailed(false);
    signOut().catch(() => setSignOutFailed(true));
  };
  return (
    <AppShell
      productName="ACME People"
      logo={<Logo />}
      navGroups={navGroupsFor(can)}
      activeKey={activeKeyFor(pathname)}
      user={{ name: me.name, role: me.role.name }}
      phoneActions={
        <IconButton
          label="Help & guide"
          icon={<IconHelpCircle size={20} stroke={1.75} />}
          href="/help"
        />
      }
      userAction={
        <IconButton
          label="Sign out"
          icon={<IconLogout size={20} stroke={1.75} />}
          onClick={endSession}
        />
      }
    >
      {signOutFailed && (
        <ErrorState
          title="You are still signed in"
          description="ACME People could not end your session, so this browser can still open the app. Try again, or close the browser if it keeps failing."
          onRetry={endSession}
          retryLabel="Try signing out again"
        />
      )}
      <ErrorBoundary key={pathname}>
        <Suspense fallback={<RouteSkeleton pathname={pathname} />}>
          <Outlet />
        </Suspense>
      </ErrorBoundary>
    </AppShell>
  );
}
