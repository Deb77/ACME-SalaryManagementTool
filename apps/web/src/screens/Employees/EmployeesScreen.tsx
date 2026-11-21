import { useDebouncedValue } from '@mantine/hooks';
import { useState } from 'react';
import { employeeExportUrl, listEmployees, type EmployeeSortField } from '../../api/endpoints';
import { useResource } from '../../api/useResource';
import type { TableQuery } from '../../components';
import { useSession } from '../../session/SessionContext';
import type { EmployeeFilters } from './Employees.utils';
import { EmployeesView } from './EmployeesView';

const PAGE_SIZE = 25;

/** Container: owns the list query and fetches `GET /api/employees`. */
export function EmployeesScreen() {
  const { me, meta, can } = useSession();
  const [search, setSearch] = useState('');
  const [q] = useDebouncedValue(search.trim(), 300);
  const [filters, setFilters] = useState<EmployeeFilters>({ status: 'active' });
  const [query, setQuery] = useState<TableQuery<EmployeeSortField>>({
    page: 1,
    pageSize: PAGE_SIZE,
  });

  const countries = meta.countries.filter((country) => me.countries.includes(country.code));
  // With one visible country the list is already scoped to it; naming it keeps salary sortable.
  const onlyCountry = countries.length === 1 ? countries[0]?.code : undefined;
  const country = filters.country ?? onlyCountry;

  const params = {
    q: q || undefined,
    country: country ? [country] : undefined,
    department: filters.department ? [filters.department] : undefined,
    jobTitle: filters.jobTitle ? [filters.jobTitle] : undefined,
    status: filters.status,
    sort: query.sort,
  };
  const employees = useResource(JSON.stringify({ ...params, page: query.page }), (signal) =>
    listEmployees({ ...params, page: query.page, pageSize: query.pageSize }, { signal }),
  );
  const shown = employees.data ?? employees.previous;
  const refreshing = employees.status === 'loading' && shown !== undefined;

  return (
    <EmployeesView
      status={employees.status === 'idle' ? 'loading' : employees.status}
      error={employees.error}
      onRetry={employees.reload}
      rows={shown?.items ?? []}
      total={shown?.total ?? 0}
      refreshing={refreshing}
      query={query}
      onQueryChange={setQuery}
      search={search}
      appliedSearch={q}
      onSearchChange={(value) => {
        setSearch(value);
        setQuery((current) => ({ ...current, page: 1 }));
      }}
      filters={filters}
      onFiltersChange={(next) => {
        setFilters(next);
        // Salary sorting needs exactly one country (salaries are in local currency).
        setQuery((current) => ({
          ...current,
          page: 1,
          sort:
            current.sort?.field === 'salary' && !(next.country ?? onlyCountry)
              ? undefined
              : current.sort,
        }));
      }}
      countries={countries}
      departments={meta.departments.map((d) => ({ value: d.id, label: d.name }))}
      jobTitles={meta.jobTitles.map((t) => ({ value: t.id, label: t.name }))}
      exportHref={can('employees:export') ? employeeExportUrl(params) : undefined}
      canAdd={can('employees:write')}
      canImport={can('imports:run')}
    />
  );
}
