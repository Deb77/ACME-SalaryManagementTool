import type {
  CountryInfo,
  CountryPayStats,
  InsightsByTitle,
  InsightsOverview,
  SalaryDistribution,
} from '@acme/shared';
import { IconSparkles } from '@tabler/icons-react';
import {
  DataTable,
  EmptyState,
  HistogramChart,
  KeyValueList,
  MeterBar,
  MoneyText,
  PageHeader,
  PayRangeRow,
  PillButton,
  SegmentedControl,
  Skeleton,
  StatTile,
  TrayCard,
  type DataTableColumn,
} from '../../components';
import { formatMoney } from '../../lib/money';
import { formatCount, formatDate } from '../../lib/format';
import { ResourceState } from '../shared/ResourceState';
import { PayByTitleSkeleton } from './InsightsSkeleton';
import shared from '../shared/screen.module.css';
import styles from './Insights.module.css';

export interface AsyncData<T> {
  status: 'loading' | 'success' | 'error';
  data?: T;
  error?: unknown;
  onRetry?: () => void;
}

export interface InsightsViewProps {
  overview: InsightsOverview;
  countries: readonly CountryInfo[];
  selectedCountry: string;
  onCountryChange: (code: string) => void;
  byTitle: AsyncData<InsightsByTitle>;
  distribution: AsyncData<SalaryDistribution>;
  canAsk: boolean;
}

const usd = (amountMinor: number, compact = true) =>
  formatMoney({ amountMinor, currency: 'USD' }, { compact });

/** Insights: per-country pay statistics, each in its own currency; org totals are indicative USD. */
export function InsightsView({
  overview,
  countries,
  selectedCountry,
  onCountryChange,
  byTitle,
  distribution,
  canAsk,
}: InsightsViewProps) {
  const countryName = (code: string) => countries.find((c) => c.code === code)?.name ?? code;
  const selected = overview.countries.find((c) => c.country === selectedCountry);
  const maxPayroll = Math.max(1, ...overview.countries.map((c) => c.payrollUsdIndicativeMinor));
  const ratesNote = `USD is indicative · fixed rates as of ${formatDate(overview.fx.ratesAsOf)}`;

  if (overview.countries.length === 0) {
    return (
      <>
        <PageHeader title="How ACME pays people" />
        <EmptyState
          title="No active employees yet"
          description="Insights appear once employees are added or imported."
        />
      </>
    );
  }

  const countryColumns: DataTableColumn<CountryPayStats>[] = [
    { key: 'country', width: '30%', title: 'Country', render: (c) => countryName(c.country) },
    {
      key: 'headcount',
      width: '13%',
      title: 'People',
      align: 'right',
      render: (c) => formatCount(c.headcount),
    },
    {
      key: 'median',
      width: '21%',
      title: 'Median',
      align: 'right',
      render: (c) => <MoneyText amountMinor={c.medianMinor} currency={c.currency} />,
    },
    {
      key: 'payroll',
      width: '36%',
      title: 'Payroll (USD)',
      render: (c) => (
        <div className={styles.payrollCell}>
          <MeterBar value={c.payrollUsdIndicativeMinor} max={maxPayroll} />
          <span>{usd(c.payrollUsdIndicativeMinor)}</span>
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="How ACME pays people"
        description="Active employees · annual base salary · each country in its own currency"
        actions={
          canAsk && (
            <PillButton href="/ask" icon={<IconSparkles size={16} />}>
              Ask about this data
            </PillButton>
          )
        }
      />
      <div className={shared.tiles}>
        <StatTile
          variant="hero"
          label="Active employees"
          value={formatCount(overview.total.headcount)}
          note={`across ${overview.countries.length} countries`}
          trend={overview.countries.map((c) => c.headcount)}
        />
        <StatTile
          label="Annual payroll"
          value={usd(overview.total.payrollUsdIndicativeMinor)}
          delta="USD"
          note="indicative total"
          trend={overview.countries.map((c) => c.payrollUsdIndicativeMinor)}
        />
        <StatTile
          label="Countries"
          value={String(overview.countries.length)}
          note="currencies, local stats"
        />
        {selected && (
          <StatTile
            label={`Median · ${countryName(selected.country)}`}
            value={
              <MoneyText amountMinor={selected.medianMinor} currency={selected.currency} compact />
            }
            note={`${formatCount(selected.headcount)} people`}
          />
        )}
      </div>

      <div className={styles.countryPicker}>
        <SegmentedControl
          label="Country"
          options={overview.countries.map((c) => ({
            value: c.country,
            label: countryName(c.country),
          }))}
          value={selectedCountry}
          onChange={onCountryChange}
        />
      </div>

      <div className={shared.twoColumns}>
        <TrayCard
          title="Pay by job title"
          extra={
            selected && (
              <span className={`${shared.small} ${shared.muted}`}>
                {countryName(selected.country)} median{' '}
                <MoneyText amountMinor={selected.medianMinor} currency={selected.currency} strong />
              </span>
            )
          }
          footer={
            byTitle.data ? (
              <span>
                {byTitle.data.rows.length} titles · sorted by median · bar is min to max, dot is the
                median
              </span>
            ) : byTitle.status === 'loading' ? (
              <Skeleton width={320} height={13} />
            ) : undefined
          }
        >
          <ResourceState
            status={byTitle.status}
            error={byTitle.error}
            onRetry={byTitle.onRetry}
            loadingLabel="Loading pay by job title…"
            skeleton={<PayByTitleSkeleton />}
          >
            {byTitle.data && byTitle.data.rows.length > 0 ? (
              <ul className={styles.titleList} aria-label="Pay by job title">
                {[...byTitle.data.rows]
                  .sort((a, b) => b.medianMinor - a.medianMinor)
                  .map((row, _index, rows) => (
                    <li key={row.jobTitle.id}>
                      <PayRangeRow
                        title={`${row.jobTitle.name} · ${formatCount(row.headcount)}`}
                        currency={byTitle.data?.currency ?? ''}
                        minMinor={row.minMinor}
                        medianMinor={row.medianMinor}
                        maxMinor={row.maxMinor}
                        scaleMinMinor={0}
                        scaleMaxMinor={Math.max(...rows.map((r) => r.maxMinor))}
                      />
                    </li>
                  ))}
              </ul>
            ) : (
              <EmptyState title="No job titles to compare" />
            )}
          </ResourceState>
        </TrayCard>

        {selected && (
          <TrayCard
            title={`${countryName(selected.country)} at a glance`}
            footer={
              selected.medianMinor > 0 && (
                <span>
                  Average is{' '}
                  {Math.round(
                    ((selected.avgMinor - selected.medianMinor) / selected.medianMinor) * 100,
                  )}
                  % {selected.avgMinor >= selected.medianMinor ? 'above' : 'below'} the median
                </span>
              )
            }
          >
            <KeyValueList
              items={[
                {
                  label: 'Lowest',
                  value: <MoneyText amountMinor={selected.minMinor} currency={selected.currency} />,
                },
                {
                  label: 'Median',
                  value: (
                    <MoneyText
                      amountMinor={selected.medianMinor}
                      currency={selected.currency}
                      strong
                    />
                  ),
                },
                {
                  label: 'Average',
                  value: <MoneyText amountMinor={selected.avgMinor} currency={selected.currency} />,
                },
                {
                  label: 'Highest',
                  value: <MoneyText amountMinor={selected.maxMinor} currency={selected.currency} />,
                },
                { label: 'People', value: formatCount(selected.headcount) },
              ]}
            />
          </TrayCard>
        )}
      </div>

      <div className={`${shared.twoColumns} ${styles.evenColumns}`}>
        <TrayCard
          title={`Salary spread · ${countryName(selectedCountry)}`}
          footer="Annual salary bands · the darker bar holds the median"
        >
          <ResourceState
            status={distribution.status}
            error={distribution.error}
            onRetry={distribution.onRetry}
            loadingLabel="Loading salary spread…"
            loadingShape="chart"
          >
            {distribution.data && distribution.data.buckets.length > 0 && selected ? (
              <SpreadChart
                distribution={distribution.data}
                stats={selected}
                countryName={countryName(selected.country)}
              />
            ) : (
              <EmptyState title="No salaries to chart" />
            )}
          </ResourceState>
        </TrayCard>

        <TrayCard
          title="Payroll by country"
          flush
          extra={
            <span className={shared.small}>
              Total <strong>{usd(overview.total.payrollUsdIndicativeMinor)}</strong>
            </span>
          }
          footer={ratesNote}
        >
          <DataTable
            label="Payroll by country"
            columns={countryColumns}
            rows={[...overview.countries].sort(
              (a, b) => b.payrollUsdIndicativeMinor - a.payrollUsdIndicativeMinor,
            )}
            rowKey={(c) => c.country}
            total={overview.countries.length}
            query={{ page: 1, pageSize: Math.max(1, overview.countries.length) }}
            onQueryChange={() => {}}
            itemName="countries"
            renderCard={(c) => (
              <div className={styles.countryCard}>
                <div className={styles.countryLine}>
                  <strong>{countryName(c.country)}</strong>
                  <span>{usd(c.payrollUsdIndicativeMinor)}</span>
                </div>
                <div className={`${shared.small} ${shared.muted}`}>
                  {formatCount(c.headcount)} people · median{' '}
                  <MoneyText amountMinor={c.medianMinor} currency={c.currency} />
                </div>
                <MeterBar value={c.payrollUsdIndicativeMinor} max={maxPayroll} />
              </div>
            )}
          />
        </TrayCard>
      </div>
    </>
  );
}

function SpreadChart({
  distribution,
  stats,
  countryName,
}: {
  distribution: SalaryDistribution;
  stats: CountryPayStats;
  countryName: string;
}) {
  const label = (amountMinor: number) =>
    formatMoney({ amountMinor, currency: distribution.currency }, { compact: true });
  const bins = distribution.buckets.map((bucket) => ({
    label: label(bucket.fromMinor),
    count: bucket.count,
  }));
  const medianIndex = distribution.buckets.findIndex(
    (b) => stats.medianMinor >= b.fromMinor && stats.medianMinor < b.toMinor,
  );
  const largest = distribution.buckets.reduce((a, b) => (b.count > a.count ? b : a));
  return (
    <HistogramChart
      summary={`${formatCount(stats.headcount)} ${countryName} salaries in ${bins.length} bands; the most common band is ${label(largest.fromMinor)} to ${label(largest.toMinor)}.`}
      bins={bins}
      highlightIndex={medianIndex >= 0 ? medianIndex : undefined}
    />
  );
}
