import { lazy } from 'react';
import { Navigate, Route, Routes } from 'react-router';
import { AppLink, EmptyState } from '../components';
import { useSession } from '../session/SessionContext';
import { AppLayout } from './AppLayout';
import { homePathFor } from './navigation';
import { RequirePermission } from './RequirePermission';

const EmployeesScreen = lazy(() =>
  import('../screens/Employees/EmployeesScreen').then((m) => ({ default: m.EmployeesScreen })),
);
const EmployeeDetailScreen = lazy(() =>
  import('../screens/EmployeeDetail/EmployeeDetailScreen').then((m) => ({
    default: m.EmployeeDetailScreen,
  })),
);
const EmployeeFormScreen = lazy(() =>
  import('../screens/EmployeeForm/EmployeeFormScreen').then((m) => ({
    default: m.EmployeeFormScreen,
  })),
);
const ImportScreen = lazy(() =>
  import('../screens/Import/ImportScreen').then((m) => ({ default: m.ImportScreen })),
);
const InsightsScreen = lazy(() =>
  import('../screens/Insights/InsightsScreen').then((m) => ({ default: m.InsightsScreen })),
);
const AskScreen = lazy(() =>
  import('../screens/Ask/AskScreen').then((m) => ({ default: m.AskScreen })),
);
const AccessScreen = lazy(() =>
  import('../screens/Access/AccessScreen').then((m) => ({ default: m.AccessScreen })),
);

function Home() {
  const { can } = useSession();
  const home = homePathFor(can);
  if (!home) {
    return (
      <EmptyState
        title="Nothing to show yet"
        description="Your role has no pages. Ask a Global HR admin."
      />
    );
  }
  return <Navigate to={home} replace />;
}

function NotFound() {
  return (
    <EmptyState
      title="Page not found"
      description="The link may be old or mistyped."
      action={<AppLink href="/">Go to the start page</AppLink>}
    />
  );
}

/** Every route of the app. Each screen is its own chunk. */
export function AppRoutes() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<Home />} />
        <Route
          path="employees"
          element={
            <RequirePermission anyOf={['employees:read']}>
              <EmployeesScreen />
            </RequirePermission>
          }
        />
        <Route
          path="employees/new"
          element={
            <RequirePermission anyOf={['employees:write']}>
              <EmployeeFormScreen />
            </RequirePermission>
          }
        />
        <Route
          path="employees/import"
          element={
            <RequirePermission anyOf={['imports:run']}>
              <ImportScreen />
            </RequirePermission>
          }
        />
        <Route
          path="employees/:id"
          element={
            <RequirePermission anyOf={['employees:read']}>
              <EmployeeDetailScreen />
            </RequirePermission>
          }
        />
        <Route
          path="employees/:id/edit"
          element={
            <RequirePermission anyOf={['employees:write']}>
              <EmployeeFormScreen />
            </RequirePermission>
          }
        />
        <Route
          path="insights"
          element={
            <RequirePermission anyOf={['insights:read']}>
              <InsightsScreen />
            </RequirePermission>
          }
        />
        <Route
          path="ask"
          element={
            <RequirePermission anyOf={['ai:ask']}>
              <AskScreen />
            </RequirePermission>
          }
        />
        <Route
          path="access"
          element={
            <RequirePermission anyOf={['users:manage', 'roles:manage']}>
              <AccessScreen />
            </RequirePermission>
          }
        />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
