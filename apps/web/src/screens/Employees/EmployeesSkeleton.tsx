import { employeeExportUrl } from '../../api/endpoints';
import { PageSkeleton } from '../../components';
import { useOptionalSession } from '../../session/SessionContext';
import { EmployeesView } from './EmployeesView';

/**
 * The Employees screen while its code downloads: the real view in its loading state, so the
 * header, buttons, search, filters and column headers are exactly the loaded ones.
 */
export function EmployeesSkeleton() {
  const session = useOptionalSession();
  // Before the session loads (first page load), assume everything is visible.
  const can = session?.can ?? (() => true);
  const meta = session?.meta;
  return (
    <PageSkeleton label="Loading employees…">
      <EmployeesView
        status="loading"
        rows={[]}
        total={0}
        query={{ page: 1, pageSize: 25 }}
        onQueryChange={() => {}}
        search=""
        onSearchChange={() => {}}
        filters={{ status: 'active' }}
        onFiltersChange={() => {}}
        countries={
          meta?.countries.filter((country) => session?.me.countries.includes(country.code)) ?? []
        }
        departments={meta?.departments.map((d) => ({ value: d.id, label: d.name })) ?? []}
        jobTitles={meta?.jobTitles.map((t) => ({ value: t.id, label: t.name })) ?? []}
        exportHref={can('employees:export') ? employeeExportUrl({ status: 'active' }) : undefined}
        canAdd={can('employees:write')}
        canImport={can('imports:run')}
      />
    </PageSkeleton>
  );
}
