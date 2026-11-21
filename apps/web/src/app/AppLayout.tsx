import { IconLogout } from '@tabler/icons-react';
import { Suspense } from 'react';
import { Outlet, useLocation } from 'react-router';
import { AppShell, ErrorBoundary, IconButton } from '../components';
import { useSession } from '../session/SessionContext';
import { activeKeyFor, navGroupsFor } from './navigation';
import { RouteSkeleton } from './RouteSkeleton';

/** The signed-in frame: AppShell with permission-filtered navigation around the routes. */
export function AppLayout() {
  const { me, can, signOut } = useSession();
  const { pathname } = useLocation();
  return (
    <AppShell
      productName="ACME People"
      logo="A"
      navGroups={navGroupsFor(can)}
      activeKey={activeKeyFor(pathname)}
      user={{ name: me.name, role: me.role.name }}
      userAction={
        <IconButton
          label="Sign out"
          icon={<IconLogout size={20} stroke={1.75} />}
          onClick={() => void signOut()}
        />
      }
    >
      <ErrorBoundary key={pathname}>
        <Suspense fallback={<RouteSkeleton pathname={pathname} />}>
          <Outlet />
        </Suspense>
      </ErrorBoundary>
    </AppShell>
  );
}
