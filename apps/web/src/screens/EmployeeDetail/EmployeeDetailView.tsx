import type { Employee, SalaryChange } from '@acme/shared';
import { IconChevronLeft, IconCash } from '@tabler/icons-react';
import type { ReactNode } from 'react';
import {
  AppLink,
  DataTable,
  EmptyState,
  KeyValueList,
  MoneyText,
  PageHeader,
  PayRangeRow,
  PillButton,
  Skeleton,
  StatusTag,
  TrayCard,
  type DataTableColumn,
  type StatusTone,
} from '../../components';
import {
  formatCount,
  formatDate,
  percentChange,
  salaryReasonLabel,
  terminationReasonLabel,
} from '../../lib/format';
import { StatusBadge } from '../shared/StatusBadge';
import { ResourceState } from '../shared/ResourceState';
import shared from '../shared/screen.module.css';
import styles from './EmployeeDetail.module.css';

export interface PayBenchmark {
  headcount: number;
  minMinor: number;
  medianMinor: number;
  maxMinor: number;
}

export interface EmployeeDetailViewProps {
  employee: Employee;
  countryName: string;
  history: {
    status: 'loading' | 'success' | 'error';
    items: readonly SalaryChange[];
    error?: unknown;
    onRetry?: () => void;
  };
  /** Pay range for the same title and country; omitted without `insights:read`. */
  benchmark?: PayBenchmark | null;
  canChangeSalary: boolean;
  canEdit: boolean;
  canTerminate: boolean;
  onRecordSalaryChange: () => void;
  onTerminate: () => void;
}

const REASON_TONES: Record<string, StatusTone> = {
  annual_review: 'success',
  promotion: 'info',
  market_adjustment: 'success',
  correction: 'warning',
  hire: 'neutral',
  import: 'neutral',
  import_undo: 'warning',
  other: 'neutral',
};

function ReasonTag({ reason }: { reason: string }) {
  return (
    <StatusTag tone={REASON_TONES[reason] ?? 'neutral'}>{salaryReasonLabel(reason)}</StatusTag>
  );
}

/**
 * The percentage change of one history entry. Only a raise reads as positive (green); a cut uses
 * the danger tone and an unchanged amount stays neutral, so a decrease never looks like a gain.
 */
function ChangeDelta({ change }: { change: SalaryChange }) {
  const previous = change.previousAmount?.amountMinor;
  const percent = previous !== undefined && percentChange(previous, change.amount.amountMinor);
  if (!percent || previous === undefined) return <>—</>;
  const difference = change.amount.amountMinor - previous;
  const direction = difference > 0 ? 'up' : difference < 0 ? 'down' : 'flat';
  return (
    <span className={styles.delta} data-direction={direction}>
      {percent}
    </span>
  );
}

const historyColumns: DataTableColumn<SalaryChange>[] = [
  {
    key: 'effectiveDate',
    width: '22%',
    title: 'Effective',
    render: (c) => formatDate(c.effectiveDate),
  },
  {
    key: 'reason',
    width: '15%',
    title: 'Reason',
    render: (c) => <ReasonTag reason={c.reason} />,
    skeleton: <Skeleton inline width={96} height={24} pill />,
  },
  {
    key: 'previous',
    width: '16%',
    title: 'Previous',
    align: 'right',
    render: (c) => (c.previousAmount ? <MoneyText {...c.previousAmount} /> : '—'),
  },
  {
    key: 'amount',
    width: '20%',
    title: 'New salary',
    align: 'right',
    render: (c) => <MoneyText {...c.amount} strong />,
  },
  {
    key: 'change',
    width: '15%',
    title: 'Change',
    align: 'right',
    render: (c) => <ChangeDelta change={c} />,
  },
  { key: 'note', width: '12%', title: 'Note', render: (c) => c.note ?? '' },
];

function HistoryCard({ change }: { change: SalaryChange }) {
  return (
    <div className={styles.historyCard}>
      <div className={styles.historyLine}>
        <span className={styles.historyDate}>{formatDate(change.effectiveDate)}</span>
        <ReasonTag reason={change.reason} />
      </div>
      <div className={styles.historyLine}>
        <span>
          {change.previousAmount ? <MoneyText {...change.previousAmount} /> : '—'} →{' '}
          <MoneyText {...change.amount} strong />
        </span>
        {change.previousAmount && <ChangeDelta change={change} />}
      </div>
      {change.note && <div className={styles.historyNote}>{change.note}</div>}
    </div>
  );
}

/** The salary history table with placeholder rows, under its real column headers. */
export function HistorySkeleton({ rows }: { rows: number }) {
  return (
    <DataTable
      label="Salary history"
      columns={historyColumns}
      rows={[]}
      rowKey={(change) => change.id}
      total={0}
      query={{ page: 1, pageSize: rows }}
      onQueryChange={() => {}}
      itemName="entries"
      skeletonRows={rows}
      renderCard={() => null}
      skeletonCard={
        <div className={styles.historyCard}>
          <div className={styles.historyLine}>
            <span className={styles.historyDate}>
              <Skeleton inline width={90} height={12} />
            </span>
            <Skeleton inline width={96} height={24} pill />
          </div>
          <div className={styles.historyLine}>
            <Skeleton inline width={180} height={12} />
          </div>
        </div>
      }
    />
  );
}

/** One employee: current pay against their peers, profile and the append-only salary history. */
export function EmployeeDetailView({
  employee,
  countryName,
  history,
  benchmark,
  canChangeSalary,
  canEdit,
  canTerminate,
  onRecordSalaryChange,
  onTerminate,
}: EmployeeDetailViewProps) {
  const name = `${employee.firstName} ${employee.lastName}`;
  const active = employee.status === 'active';
  const { currency, amountMinor } = employee.salary;
  const latest = history.items[0];
  const first = history.items[history.items.length - 1];
  const lastChange =
    latest?.previousAmount &&
    percentChange(latest.previousAmount.amountMinor, latest.amount.amountMinor);
  const totalChange = first && percentChange(first.amount.amountMinor, amountMinor);
  /** The figures behind "where does this pay sit", shown between the pay and its range. */
  const payStats: { label: string; value: ReactNode }[] = [
    ...(benchmark
      ? [
          {
            label: 'Peer median',
            value: <MoneyText amountMinor={benchmark.medianMinor} currency={currency} />,
          },
        ]
      : []),
    ...(benchmark && benchmark.medianMinor > 0
      ? [{ label: 'Against median', value: percentChange(benchmark.medianMinor, amountMinor) }]
      : []),
    ...(lastChange ? [{ label: 'Last change', value: lastChange }] : []),
  ];

  const profile = [
    { label: 'Employee code', value: employee.employeeCode },
    { label: 'Email', value: employee.email },
    { label: 'Job title', value: employee.jobTitle.name },
    { label: 'Department', value: employee.department.name },
    { label: 'Hire date', value: formatDate(employee.hireDate) },
    { label: 'Country', value: countryName },
    { label: 'Currency', value: currency },
    ...(employee.termination
      ? [
          { label: 'Left on', value: formatDate(employee.termination.date) },
          { label: 'Leaving reason', value: terminationReasonLabel(employee.termination.reason) },
        ]
      : []),
  ];

  return (
    <>
      <PageHeader
        back={
          <AppLink href="/employees" className={styles.back}>
            <IconChevronLeft aria-hidden="true" size={18} />
            Employees
          </AppLink>
        }
        title={name}
        description={
          <span className={styles.subtitle}>
            <span>
              {employee.jobTitle.name} · {employee.department.name} · {countryName}
            </span>
            <StatusBadge status={employee.status} />
          </span>
        }
        actions={
          ((canTerminate && active) || canEdit || (canChangeSalary && active)) && (
            // Phones: the primary action first and full width, Terminate last (see the CSS).
            <div className={styles.headerActions}>
              {canTerminate && active && (
                <PillButton tone="danger" onClick={onTerminate} className={styles.dangerAction}>
                  Terminate
                </PillButton>
              )}
              {canEdit && (
                <PillButton href={`/employees/${employee.id}/edit`}>Edit details</PillButton>
              )}
              {canChangeSalary && active && (
                <PillButton
                  tone="primary"
                  onClick={onRecordSalaryChange}
                  className={styles.primaryAction}
                >
                  Record salary change
                </PillButton>
              )}
            </div>
          )
        }
      />
      <div className={`${shared.twoColumns} ${styles.topRow}`}>
        <TrayCard
          title="Current pay"
          className={styles.payCard}
          footer={
            benchmark && (
              <span>
                Compared with {formatCount(benchmark.headcount)} {employee.jobTitle.name}s in{' '}
                {countryName}
              </span>
            )
          }
        >
          <div className={styles.payBody}>
            <div className={styles.pay}>
              <span className={styles.payIcon} aria-hidden="true">
                <IconCash size={20} />
              </span>
              <div>
                <div className={styles.payValue}>
                  <MoneyText {...employee.salary} />
                </div>
                <div className={shared.muted}>
                  per year · {currency} · effective {formatDate(employee.salaryEffectiveDate)}
                </div>
              </div>
            </div>
            {payStats.length > 0 && (
              <dl className={styles.stats}>
                {payStats.map((stat) => (
                  <div key={stat.label} className={styles.stat}>
                    <dt>{stat.label}</dt>
                    <dd>{stat.value}</dd>
                  </div>
                ))}
              </dl>
            )}
            {benchmark && (
              <div className={styles.benchmark}>
                <PayRangeRow
                  title="Pay range"
                  currency={currency}
                  minMinor={benchmark.minMinor}
                  medianMinor={benchmark.medianMinor}
                  maxMinor={benchmark.maxMinor}
                  markerMinor={amountMinor}
                  scaleMinMinor={Math.min(benchmark.minMinor, amountMinor)}
                  scaleMaxMinor={Math.max(benchmark.maxMinor, amountMinor)}
                />
                <div className={`${styles.rangeLabels} ${shared.small} ${shared.muted}`}>
                  <span>
                    Min <MoneyText amountMinor={benchmark.minMinor} currency={currency} />
                  </span>
                  <span>
                    Max <MoneyText amountMinor={benchmark.maxMinor} currency={currency} />
                  </span>
                </div>
              </div>
            )}
          </div>
        </TrayCard>
        <TrayCard title="Profile" footer="Pay currency is set by country">
          <KeyValueList items={profile} />
        </TrayCard>
      </div>
      <TrayCard
        title="Salary history"
        flush
        extra={<span className={`${shared.small} ${shared.muted}`}>Entries are permanent</span>}
        footer={
          history.status === 'success' && first ? (
            <span>
              {history.items.length} {history.items.length === 1 ? 'entry' : 'entries'} since hire
              on {formatDate(employee.hireDate)}
              {totalChange && ` · ${totalChange} total`}
            </span>
          ) : history.status === 'loading' ? (
            <Skeleton width={260} height={13} />
          ) : undefined
        }
      >
        <ResourceState
          status={history.status}
          error={history.error}
          onRetry={history.onRetry}
          loadingLabel="Loading salary history…"
          skeleton={<HistorySkeleton rows={4} />}
          errorTitle="Salary history could not load"
        >
          <DataTable
            label="Salary history"
            columns={historyColumns}
            rows={history.items}
            rowKey={(change) => change.id}
            total={history.items.length}
            query={{ page: 1, pageSize: Math.max(1, history.items.length) }}
            onQueryChange={() => {}}
            itemName="entries"
            renderCard={(change) => <HistoryCard change={change} />}
            empty={<EmptyState title="No salary entries yet" />}
          />
        </ResourceState>
      </TrayCard>
    </>
  );
}
