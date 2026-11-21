import type { CountryInfo, Employee } from '@acme/shared';
import { IconDownload, IconPlus, IconUpload } from '@tabler/icons-react';
import {
  AppLink,
  DataTable,
  EmptyState,
  FilterSelect,
  MoneyText,
  PageHeader,
  PersonCell,
  PersonCellSkeleton,
  PillButton,
  SearchField,
  Skeleton,
  TrayCard,
  type DataTableColumn,
  type FilterOption,
  type TableQuery,
} from '../../components';
import type { EmployeeSortField } from '../../api/endpoints';
import { formatCount } from '../../lib/format';
import { ResourceState } from '../shared/ResourceState';
import { StatusBadge } from '../shared/StatusBadge';
import shared from '../shared/screen.module.css';
import styles from './Employees.module.css';
import { employeePath, hasActiveFilters, type EmployeeFilters } from './Employees.utils';

export interface EmployeesViewProps {
  status: 'loading' | 'success' | 'error';
  error?: unknown;
  onRetry?: () => void;
  /** Rows of the current page (the previous page's while the next one loads). */
  rows: readonly Employee[];
  total: number;
  /** True while a new search, filter, sort or page loads; the table shows skeleton rows. */
  refreshing?: boolean;
  query: TableQuery<EmployeeSortField>;
  onQueryChange: (query: TableQuery<EmployeeSortField>) => void;
  search: string;
  /**
   * The debounced search the rows were fetched with. The "matching" count, Clear filters
   * and the empty state follow it, so they don't change on every keystroke.
   */
  appliedSearch?: string;
  onSearchChange: (value: string) => void;
  filters: EmployeeFilters;
  onFiltersChange: (filters: EmployeeFilters) => void;
  countries: readonly CountryInfo[];
  departments: readonly FilterOption[];
  jobTitles: readonly FilterOption[];
  /** Download link for the CSV of the current filters; omitted without `employees:export`. */
  exportHref?: string;
  canAdd: boolean;
  canImport: boolean;
}

const STATUS_OPTIONS: FilterOption[] = [
  { value: 'active', label: 'Active' },
  { value: 'terminated', label: 'Terminated' },
];

/** Employees directory: search, filters and a server-paged table (cards on phones). */
export function EmployeesView({
  status,
  error,
  onRetry,
  rows,
  total,
  refreshing = false,
  query,
  onQueryChange,
  search,
  appliedSearch = search,
  onSearchChange,
  filters,
  onFiltersChange,
  countries,
  departments,
  jobTitles,
  exportHref,
  canAdd,
  canImport,
}: EmployeesViewProps) {
  const countryName = (code: string) => countries.find((c) => c.code === code)?.name ?? code;
  const filtered = hasActiveFilters(filters, appliedSearch);
  const columns: DataTableColumn<Employee>[] = [
    {
      key: 'name',
      title: 'Employee',
      width: '25%',
      sortable: true,
      render: (employee) => (
        <PersonCell
          name={`${employee.firstName} ${employee.lastName}`}
          detail={`${employee.employeeCode} · ${employee.email}`}
          href={employeePath(employee.id)}
        />
      ),
      skeleton: <PersonCellSkeleton nameWidth={110} detailWidth={210} />,
    },
    {
      key: 'jobTitle',
      title: 'Job title',
      width: '19%',
      sortable: true,
      render: (employee) => employee.jobTitle.name,
    },
    {
      key: 'department',
      title: 'Department',
      width: '12%',
      sortable: true,
      // Tablets and small laptops: the column that matters least gives way so the rest fit.
      wideOnly: true,
      render: (employee) => employee.department.name,
    },
    {
      key: 'country',
      title: 'Country',
      width: '14%',
      render: (employee) => countryName(employee.country),
    },
    {
      key: 'salary',
      title: 'Annual salary',
      width: '16%',
      align: 'right',
      // Salaries are in local currency, so the API sorts them only within one country.
      sortable: filters.country !== undefined,
      render: (employee) => <MoneyText {...employee.salary} strong />,
    },
    {
      key: 'status',
      title: 'Status',
      width: '14%',
      render: (employee) => <StatusBadge status={employee.status} />,
      skeleton: <Skeleton inline width={68} height={24} pill />,
    },
  ];

  const setFilter = (patch: Partial<EmployeeFilters>) => onFiltersChange({ ...filters, ...patch });

  return (
    <>
      <PageHeader
        title="Employees"
        description={
          status === 'success' || refreshing
            ? `${formatCount(total)} ${filtered ? 'matching' : 'active'} ${total === 1 ? 'person' : 'people'}`
            : 'Everyone you can see, in their own currency'
        }
        actions={
          <>
            {exportHref && (
              <PillButton href={exportHref} download icon={<IconDownload size={16} />}>
                Export CSV
              </PillButton>
            )}
            {canImport && (
              <PillButton href="/employees/import" icon={<IconUpload size={16} />}>
                Import from Excel
              </PillButton>
            )}
            {canAdd && (
              <PillButton tone="primary" href="/employees/new" icon={<IconPlus size={16} />}>
                Add employee
              </PillButton>
            )}
          </>
        }
      />
      <TrayCard
        title="Employee directory"
        flush
        fill
        extra={
          <SearchField
            label="Search employees"
            placeholder="Name, email or employee code"
            value={search}
            onChange={onSearchChange}
          />
        }
      >
        <div className={shared.toolbar} role="group" aria-label="Filters">
          <FilterSelect
            label="Country"
            options={countries.map((c) => ({ value: c.code, label: c.name }))}
            value={filters.country}
            onChange={(country) => setFilter({ country })}
          />
          <FilterSelect
            label="Status"
            options={STATUS_OPTIONS}
            value={filters.status === 'all' ? undefined : filters.status}
            onChange={(value) =>
              setFilter({ status: (value as EmployeeFilters['status']) ?? 'all' })
            }
          />
          <FilterSelect
            label="Department"
            options={departments}
            value={filters.department}
            onChange={(department) => setFilter({ department })}
          />
          <FilterSelect
            label="Job title"
            options={jobTitles}
            value={filters.jobTitle}
            onChange={(jobTitle) => setFilter({ jobTitle })}
          />
          {filtered && (
            <PillButton
              tone="quiet"
              size="small"
              onClick={() => {
                onSearchChange('');
                onFiltersChange({ status: 'active' });
              }}
            >
              Clear filters
            </PillButton>
          )}
        </div>
        <div className={styles.results}>
          <ResourceState
            status={refreshing ? 'success' : status}
            error={error}
            onRetry={onRetry}
            loadingLabel="Loading employees…"
            skeleton={
              <DataTable<Employee, EmployeeSortField>
                label="Employees"
                columns={columns}
                rows={[]}
                rowKey={(employee) => employee.id}
                total={0}
                query={query}
                onQueryChange={() => {}}
                fill
                skeletonRows={8}
                skeletonCard={<EmployeeCardSkeleton />}
                renderCard={() => null}
              />
            }
            errorTitle="Employees could not load"
          >
            <DataTable<Employee, EmployeeSortField>
              label="Employees"
              columns={columns}
              rows={rows}
              rowKey={(employee) => employee.id}
              total={total}
              query={query}
              onQueryChange={onQueryChange}
              // A search, filter, sort or page change: the first-load skeleton rows (cards on
              // phones) replace the old rows, while the search and filters stay mounted.
              loading={refreshing}
              skeletonCard={<EmployeeCardSkeleton />}
              fill
              itemName="employees"
              renderCard={(employee) => (
                <EmployeeCard employee={employee} countryName={countryName} />
              )}
              empty={
                filtered ? (
                  <EmptyState
                    title="No employees match"
                    description="Try another name or clear the filters."
                    action={
                      <PillButton
                        onClick={() => {
                          onSearchChange('');
                          onFiltersChange({ status: 'active' });
                        }}
                      >
                        Clear filters
                      </PillButton>
                    }
                  />
                ) : (
                  <EmptyState
                    title="No employees yet"
                    description="Add people one by one or import your spreadsheet."
                    action={
                      canAdd ? (
                        <PillButton tone="primary" href="/employees/new">
                          Add employee
                        </PillButton>
                      ) : undefined
                    }
                  />
                )
              }
            />
          </ResourceState>
        </div>
      </TrayCard>
    </>
  );
}

function EmployeeCard({
  employee,
  countryName,
}: {
  employee: Employee;
  countryName: (code: string) => string;
}) {
  const name = `${employee.firstName} ${employee.lastName}`;
  return (
    <AppLink href={employeePath(employee.id)} className={styles.card}>
      <span className={styles.cardTop}>
        <span className={styles.cardName}>{name}</span>
        <MoneyText {...employee.salary} strong />
      </span>
      <span className={styles.cardBottom}>
        <span className={styles.cardDetail}>
          {employee.jobTitle.name} · {countryName(employee.country)}
        </span>
        <span className={styles.cardCode}>{employee.employeeCode}</span>
      </span>
      {employee.status === 'terminated' && <StatusBadge status="terminated" />}
    </AppLink>
  );
}

/** EmployeeCard's two lines (name and salary, title and code) as placeholders on real lines. */
function EmployeeCardSkeleton() {
  return (
    <span className={styles.card} aria-hidden="true">
      <span className={styles.cardTop}>
        <span className={styles.cardName}>
          <Skeleton inline width={130} height={13} />
        </span>
        <Skeleton inline width={80} height={13} />
      </span>
      <span className={styles.cardBottom}>
        <span className={styles.cardDetail}>
          <Skeleton inline width={170} height={11} />
        </span>
        <Skeleton inline width={72} height={11} />
      </span>
    </span>
  );
}
