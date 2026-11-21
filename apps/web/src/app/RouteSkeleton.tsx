import { PageSkeleton } from '../components';
import { AccessSkeleton } from '../screens/Access/AccessSkeleton';
import { AskSkeleton } from '../screens/Ask/AskSkeleton';
import { EmployeeDetailSkeleton } from '../screens/EmployeeDetail/EmployeeDetailSkeleton';
import { EmployeeFormSkeleton } from '../screens/EmployeeForm/EmployeeFormSkeleton';
import { EmployeesSkeleton } from '../screens/Employees/EmployeesSkeleton';
import { ImportSkeleton } from '../screens/Import/ImportSkeleton';
import { InsightsSkeleton } from '../screens/Insights/InsightsSkeleton';
import { useOptionalSession } from '../session/SessionContext';
import { skeletonFor } from './skeletonFor';

/**
 * Shown while a route's code downloads: the screen's own skeleton where it has one, so the
 * page is laid out exactly as it will be, otherwise the closest generic PageSkeleton.
 */
export function RouteSkeleton({ pathname }: { pathname: string }) {
  const session = useOptionalSession();
  if (pathname === '/employees' || pathname === '/') return <EmployeesSkeleton />;
  if (pathname === '/employees/import') return <ImportSkeleton />;
  if (pathname === '/employees/new') {
    return <EmployeeFormSkeleton mode="add" oneCountry={session?.me.countries.length === 1} />;
  }
  if (/^\/employees\/[^/]+\/edit$/.test(pathname)) return <EmployeeFormSkeleton mode="edit" />;
  if (pathname.startsWith('/ask')) return <AskSkeleton />;
  const variant = skeletonFor(pathname);
  if (variant === 'detail') return <EmployeeDetailSkeleton />;
  if (variant === 'dashboard') return <InsightsSkeleton />;
  if (variant === 'cards') return <AccessSkeleton />;
  return <PageSkeleton variant={variant} />;
}
