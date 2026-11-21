import type { Story } from '@ladle/react';
import { useMemo, useState } from 'react';
import { ApiError } from '../../api/client';
import type { EmployeeSortField } from '../../api/endpoints';
import type { TableQuery } from '../../components';
import type { EmployeeFilters } from '../../screens/Employees/Employees.utils';
import { EmployeesView, type EmployeesViewProps } from '../../screens/Employees/EmployeesView';
import {
  sampleEmployees,
  sampleMeCountry,
  sampleMeGlobal,
  sampleMeta,
  sampleMeViewer,
} from '../screenSampleData';
import { ScreenFrame } from './ScreenFrame';

export default { title: 'Screens / Employees' };

function Employees({
  me = sampleMeGlobal,
  ...overrides
}: Partial<EmployeesViewProps> & { me?: typeof sampleMeGlobal }) {
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<EmployeeFilters>({ status: 'active' });
  const [query, setQuery] = useState<TableQuery<EmployeeSortField>>({ page: 1, pageSize: 25 });
  const rows = useMemo(
    () =>
      sampleEmployees.filter(
        (e) =>
          `${e.firstName} ${e.lastName}`.toLowerCase().includes(search.toLowerCase()) &&
          (!filters.country || e.country === filters.country),
      ),
    [search, filters],
  );
  const can = (p: (typeof me.permissions)[number]) => me.permissions.includes(p);
  return (
    <ScreenFrame me={me} path="/employees">
      <EmployeesView
        status="success"
        rows={rows}
        total={rows.length}
        query={query}
        onQueryChange={setQuery}
        search={search}
        onSearchChange={setSearch}
        filters={filters}
        onFiltersChange={setFilters}
        countries={sampleMeta.countries}
        departments={sampleMeta.departments.map((d) => ({ value: d.id, label: d.name }))}
        jobTitles={sampleMeta.jobTitles.map((t) => ({ value: t.id, label: t.name }))}
        exportHref={can('employees:export') ? '#export' : undefined}
        canAdd={can('employees:write')}
        canImport={can('imports:run')}
        {...overrides}
      />
    </ScreenFrame>
  );
}

export const GlobalHr: Story = () => <Employees />;
GlobalHr.storyName = 'Global HR';
GlobalHr.meta = { fullscreen: true };

/** India HR: one visible country, so there is no Country filter. */
export const CountryHr: Story = () => (
  <Employees
    me={sampleMeCountry}
    rows={sampleEmployees.filter((e) => e.country === 'IN')}
    total={sampleEmployees.filter((e) => e.country === 'IN').length}
    countries={sampleMeta.countries.filter((c) => c.code === 'IN')}
  />
);
CountryHr.storyName = 'Country HR (one country)';
CountryHr.meta = { fullscreen: true };

export const ReadOnly: Story = () => <Employees me={sampleMeViewer} />;
ReadOnly.storyName = 'Read-only role (no add, import or export)';
ReadOnly.meta = { fullscreen: true };

export const Loading: Story = () => <Employees status="loading" rows={[]} total={0} />;
Loading.meta = { fullscreen: true };

export const Refreshing: Story = () => <Employees status="loading" refreshing />;
Refreshing.storyName = 'Refreshing (search, filter or page loading)';
Refreshing.meta = { fullscreen: true };

export const NoMatches: Story = () => <Employees rows={[]} total={0} search="zzz" />;
NoMatches.storyName = 'No matches';
NoMatches.meta = { fullscreen: true };

export const Failed: Story = () => (
  <Employees
    status="error"
    error={new ApiError(500, 'internal_error', 'Something went wrong on the server.')}
    rows={[]}
    total={0}
  />
);
Failed.storyName = 'Error';
Failed.meta = { fullscreen: true };
