import type { Story } from '@ladle/react';
import { Anchor, Breadcrumbs } from '@mantine/core';
import { IconDownload, IconPlus, IconUpload } from '@tabler/icons-react';
import { useMemo, useState } from 'react';
import {
  AppShell,
  DataTable,
  EmptyState,
  FilterSelect,
  MoneyText,
  PageHeader,
  PersonCell,
  PillButton,
  SearchField,
  StatusTag,
  TrayCard,
  type DataTableColumn,
  type TableQuery,
} from '../components';
import { row } from './layout';
import { employees, navGroups, type SampleEmployee } from './sampleData';

export default { title: 'Templates / Layout' };

type SortField = 'name' | 'salary';

const columns: DataTableColumn<SampleEmployee>[] = [
  {
    key: 'name',
    title: 'Employee',
    sortable: true,
    render: (employee) => (
      <PersonCell name={employee.name} detail={`${employee.code} · ${employee.email}`} href="#" />
    ),
  },
  { key: 'title', title: 'Job title', render: (employee) => employee.title },
  { key: 'department', title: 'Department', render: (employee) => employee.department },
  {
    key: 'salary',
    title: 'Salary',
    align: 'right',
    sortable: true,
    render: (employee) => (
      <MoneyText amountMinor={employee.salaryMinor} currency={employee.currency} strong />
    ),
  },
  {
    key: 'status',
    title: 'Status',
    render: (employee) =>
      employee.status === 'active' ? (
        <StatusTag tone="success" dot>
          Active
        </StatusTag>
      ) : (
        <StatusTag tone="neutral">Terminated</StatusTag>
      ),
  },
];

/** Client-side stand-in for the server: filters, sorts and pages the sample employees. */
function useSampleEmployees(search: string, query: TableQuery<SortField>) {
  return useMemo(() => {
    const filtered = employees.filter((employee) =>
      employee.name.toLowerCase().includes(search.toLowerCase()),
    );
    const sorted = [...filtered];
    if (query.sort) {
      const { field, order } = query.sort;
      const direction = order === 'asc' ? 1 : -1;
      sorted.sort((a, b) =>
        field === 'name'
          ? a.name.localeCompare(b.name) * direction
          : (a.salaryMinor - b.salaryMinor) * direction,
      );
    }
    return {
      total: filtered.length,
      page: sorted.slice((query.page - 1) * query.pageSize, query.page * query.pageSize),
    };
  }, [search, query]);
}

export const EmployeeDirectory: Story = () => {
  const [search, setSearch] = useState('');
  const [country, setCountry] = useState<string | undefined>('IN');
  const [query, setQuery] = useState<TableQuery<SortField>>({ page: 1, pageSize: 5 });
  const rows = useSampleEmployees(search, query);

  return (
    <TrayCard
      title="Employee directory"
      flush
      extra={
        <SearchField
          label="Search employees"
          placeholder="Name, email or employee code"
          value={search}
          onChange={(value) => {
            setSearch(value);
            setQuery((current) => ({ ...current, page: 1 }));
          }}
        />
      }
      footer={<span>Sorting and paging are reported to the parent, which would call the API.</span>}
    >
      <div style={{ ...row, padding: '12px 16px' }}>
        <FilterSelect
          label="Country"
          options={[
            { value: 'IN', label: 'India' },
            { value: 'GB', label: 'United Kingdom' },
            { value: 'US', label: 'United States' },
          ]}
          value={country}
          onChange={setCountry}
        />
        <PillButton tone="quiet" size="small" onClick={() => setCountry(undefined)}>
          Clear filters
        </PillButton>
      </div>
      <DataTable<SampleEmployee, SortField>
        label="Employees"
        columns={columns}
        rows={rows.page}
        rowKey={(employee) => employee.id}
        total={rows.total}
        query={query}
        onQueryChange={setQuery}
        itemName="employees"
        empty={
          <EmptyState
            title="No employees match"
            description="Try a different name."
            action={<PillButton onClick={() => setSearch('')}>Clear search</PillButton>}
          />
        }
      />
    </TrayCard>
  );
};

export const AppShellWithPage: Story = () => (
  <AppShell
    productName="ACME People"
    logo="✳"
    navGroups={navGroups}
    activeKey="employees"
    user={{ name: 'Riya Kapoor', role: 'Global HR' }}
    topBarStart={
      <Breadcrumbs>
        <Anchor href="#" c="dimmed">
          People
        </Anchor>
        <span aria-current="page">Employees</span>
      </Breadcrumbs>
    }
    topBarEnd={
      <SearchField
        label="Search everything"
        placeholder="Search…"
        value=""
        onChange={() => {}}
        width={260}
      />
    }
  >
    <PageHeader
      title="Employees"
      description="9,500 active across 8 countries"
      actions={
        <>
          <PillButton icon={<IconDownload size={16} />}>Export CSV</PillButton>
          <PillButton icon={<IconUpload size={16} />}>Import from Excel</PillButton>
          <PillButton tone="primary" icon={<IconPlus size={16} />}>
            Add employee
          </PillButton>
        </>
      }
    />
    <EmployeeDirectory />
  </AppShell>
);
AppShellWithPage.storyName = 'App shell';
