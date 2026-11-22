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
  StatTile,
  TrayCard,
  type DataTableColumn,
} from '../../components';
import { formatMoney, roundToMajor } from '../../lib/money';
import { formatCount, formatDate } from '../../lib/format';
import { ResourceState } from '../shared/ResourceState';
import { PayByTitleSkeleton, TitlesNote } from './InsightsSkeleton';
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
  /** Whether the user sees every country (Global HR) rather than the ones assigned to them. */
  allCountries: boolean;
}

const usd = (amountMinor: number, compact = true) =>
  formatMoney({ amountMinor, currency: 'USD' }, { compact });

/**
 * Insights in two parts: first everyone the user can see (headline figures, one median across
 * their countries, payroll by country), then the country picked below it (pay by title, its
 * figures and salary spread). Per-country figures stay in local currency; totals across
 * countries are indicative USD.
 */
export function InsightsView({
  overview,
  countries,
  selectedCountry,
  onCountryChange,
  byTitle,
  distribution,
  canAsk,
  allCountries,
}: InsightsViewProps) {
  const countryName = (code: string) => countries.find((c) => c.code === code)?.name ?? code;
  const selected = overview.countries.find((c) => c.country === selectedCountry);
  const maxPayroll = Math.max(1, ...overview.countries.map((c) => c.payrollUsdIndicativeMinor));
  const ratesNote = `USD is indicative · fixed rates as of ${formatDate(overview.fx.ratesAsOf)}`;
  /**
   * The one country of a single-country scope (e.g. India HR): its data is already scoped, so
   * there is no country to pick, and payroll leads in its own currency with USD secondary.
   */
  const only = overview.countries.length === 1 ? overview.countries[0] : undefined;
  const localPayroll = (c: CountryPayStats) => (
    <MoneyText amountMinor={c.payrollMinor} currency={c.currency} compact />
  );

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
      <section className={shared.stack} aria-labelledby="insights-all">
        <h2 id="insights-all" className={styles.sectionTitle}>
          {only ? countryName(only.country) : allCountries ? 'All countries' : 'Your countries'}
        </h2>
        <div className={`${shared.tiles} ${only ? styles.threeTiles : ''}`}>
          <StatTile
            variant="hero"
            label="Active employees"
            value={formatCount(overview.total.headcount)}
            note={`across ${overview.countries.length} ${overview.countries.length === 1 ? 'country' : 'countries'}`}
            trend={overview.countries.map((c) => c.headcount)}
          />
          {only ? (
            <StatTile
              label="Annual payroll"
              value={localPayroll(only)}
              delta={only.currency}
              note={`≈ ${usd(overview.total.payrollUsdIndicativeMinor)} indicative`}
            />
          ) : (
            <StatTile
              label="Annual payroll"
              value={usd(overview.total.payrollUsdIndicativeMinor)}
              delta="USD"
              note="indicative total"
              trend={overview.countries.map((c) => c.payrollUsdIndicativeMinor)}
            />
          )}
          {!only && (
            <StatTile
              label="Countries"
              value={String(overview.countries.length)}
              note="currencies, local stats"
            />
          )}
          <StatTile
            label="Median salary"
            value={
              only ? (
                <MoneyText amountMinor={only.medianMinor} currency={only.currency} compact />
              ) : (
                usd(overview.total.medianUsdIndicativeMinor)
              )
            }
            delta={only ? only.currency : 'USD'}
            note={
              only
                ? `≈ ${usd(overview.total.medianUsdIndicativeMinor)} indicative`
                : `across ${overview.countries.length} countries, indicative`
            }
          />
        </div>
        {!only && (
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
              summary={false}
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
        )}
      </section>

      <section className={shared.stack} aria-labelledby="insights-country">
        {only ? (
          <h2 id="insights-country" className="visually-hidden">
            {countryName(only.country)} in detail
          </h2>
        ) : (
          <div className={styles.sectionHeader}>
            <h2 id="insights-country" className={styles.sectionTitle}>
              By country
            </h2>
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
          </div>
        )}
        <div className={`${shared.twoColumns} ${styles.matchedRow}`}>
          <TrayCard
            title="Pay by job title"
            extra={
              selected && (
                <span className={`${shared.small} ${shared.muted}`}>
                  {countryName(selected.country)} median{' '}
                  <MoneyText
                    amountMinor={selected.medianMinor}
                    currency={selected.currency}
                    strong
                  />
                </span>
              )
            }
            footer={
              byTitle.data ? (
                <TitlesNote count={byTitle.data.rows.length} />
              ) : byTitle.status === 'loading' ? (
                <TitlesNote />
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
                          title={row.jobTitle.name}
                          detail={formatCount(row.headcount)}
                          detailLabel={`${formatCount(row.headcount)} ${row.headcount === 1 ? 'person' : 'people'}`}
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
              className={styles.glance}
              footer={
                selected.medianMinor > 0 && (
                  <span>
                    Average is{' '}
                    {Math.abs(
                      Math.round(
                        ((selected.avgMinor - selected.medianMinor) / selected.medianMinor) * 100,
                      ),
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
                    value: (
                      <MoneyText amountMinor={selected.minMinor} currency={selected.currency} />
                    ),
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
                    // The mean has fractions of a cent; show whole units like the other figures.
                    value: (
                      <MoneyText
                        amountMinor={roundToMajor(selected.avgMinor, selected.currency)}
                        currency={selected.currency}
                      />
                    ),
                  },
                  {
                    label: 'Highest',
                    value: (
                      <MoneyText amountMinor={selected.maxMinor} currency={selected.currency} />
                    ),
                  },
                  { label: 'People', value: formatCount(selected.headcount) },
                ]}
              />
            </TrayCard>
          )}
        </div>

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
      </section>
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
      height={260}
    />
  );
}
