import { IconSparkles } from '@tabler/icons-react';
import {
  DataTable,
  KeyValueList,
  LoadingState,
  PageHeader,
  PageSkeleton,
  PayRangeRowSkeleton,
  PillButton,
  Skeleton,
  StatTile,
  TrayCard,
  type DataTableColumn,
} from '../../components';
import { useOptionalSession } from '../../session/SessionContext';
import shared from '../shared/screen.module.css';
import styles from './Insights.module.css';

const TITLE_WIDTHS = ['78%', '64%', '86%', '58%', '72%', '66%', '80%', '60%'];

/** The pay-by-title list with placeholder rows: same list, row grid and spacing. */
export function PayByTitleSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <ul className={styles.titleList} aria-hidden="true">
      {TITLE_WIDTHS.slice(0, rows).map((width, index) => (
        <li key={index}>
          <PayRangeRowSkeleton titleWidth={width} />
        </li>
      ))}
    </ul>
  );
}

/**
 * The pay-by-title footer with the count still loading: the same words, so it wraps onto the
 * same number of lines as the real one.
 */
export function TitlesNote({ count }: { count?: number }) {
  return (
    <span>
      {count ?? <Skeleton inline width={14} height={12} />} titles · sorted by median · bar is min
      to max, dot is the median
    </span>
  );
}

/** A tile value; `trend` tiles reserve the 48px mini chart's height like the real ones. */
function TileValue({ width, trend = false }: { width: number; trend?: boolean }) {
  const value = <Skeleton inline width={width} height={24} />;
  return trend ? <span className={styles.skeletonTrendValue}>{value}</span> : value;
}

const payrollColumns: DataTableColumn<never>[] = [
  { key: 'country', width: '30%', title: 'Country', render: () => null },
  { key: 'headcount', width: '13%', title: 'People', align: 'right', render: () => null },
  { key: 'median', width: '21%', title: 'Median', align: 'right', render: () => null },
  {
    key: 'payroll',
    width: '36%',
    title: 'Payroll (USD)',
    render: () => null,
    skeleton: (
      <div className={styles.payrollCell}>
        <Skeleton height={6} pill />
        <Skeleton width={56} height={12} />
      </div>
    ),
  },
];

/** InsightsView while the overview loads: real titles, tiles, cards and table headers. */
export function InsightsSkeleton() {
  // Before the session loads (first page load), assume everything is visible.
  const can = useOptionalSession()?.can ?? (() => true);
  return (
    <PageSkeleton label="Loading insights…">
      <PageHeader
        title="How ACME pays people"
        description="Active employees · annual base salary · each country in its own currency"
        actions={
          can('ai:ask') && (
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
          value={<TileValue width={110} trend />}
          note={
            <>
              across <Skeleton inline width={8} height={12} /> countries
            </>
          }
        />
        <StatTile
          label="Annual payroll"
          value={<TileValue width={130} trend />}
          delta="USD"
          note="indicative total"
        />
        <StatTile
          label="Countries"
          value={<TileValue width={30} />}
          note="currencies, local stats"
        />
        <StatTile
          label="Median"
          value={<TileValue width={100} />}
          note={
            <>
              <Skeleton inline width={40} height={12} /> people
            </>
          }
        />
      </div>
      <div className={`${styles.countryPicker} ${styles.pickerSkeleton}`}>
        <Skeleton width={620} height="100%" pill />
      </div>
      <div className={shared.twoColumns}>
        <TrayCard
          title="Pay by job title"
          extra={
            <span className={`${shared.small} ${shared.muted}`}>
              {/* As wide as "India median ₹25,00,000", so it stays beside the title on phones. */}
              <Skeleton inline width={44} height={11} /> median{' '}
              <Skeleton inline width={72} height={11} />
            </span>
          }
          footer={<TitlesNote />}
        >
          <PayByTitleSkeleton />
        </TrayCard>
        <TrayCard
          title={<Skeleton inline width={150} height={12} />}
          footer={
            <span>
              Average is <Skeleton inline width={70} height={12} /> the median
            </span>
          }
        >
          <KeyValueList
            items={['Lowest', 'Median', 'Average', 'Highest', 'People'].map((label) => ({
              label,
              value: <Skeleton inline width={80} height={12} />,
            }))}
          />
        </TrayCard>
      </div>
      <div className={`${shared.twoColumns} ${styles.evenColumns}`}>
        <TrayCard
          title="Salary spread"
          footer="Annual salary bands · the darker bar holds the median"
        >
          <LoadingState shape="chart" delayMs={0} label="" />
        </TrayCard>
        <TrayCard
          title="Payroll by country"
          flush
          extra={
            <span className={shared.small}>
              Total <Skeleton inline width={56} height={11} />
            </span>
          }
          footer={
            <>
              USD is indicative · fixed rates as of <Skeleton inline width={76} height={12} />
            </>
          }
        >
          <DataTable<never>
            label="Payroll by country"
            columns={payrollColumns}
            rows={[]}
            rowKey={() => ''}
            total={0}
            query={{ page: 1, pageSize: 8 }}
            onQueryChange={() => {}}
            skeletonRows={8}
            // Every country fits on the one page, so the real footer has no pager.
            skeletonPager={false}
            renderCard={() => null}
            skeletonCard={
              <div className={styles.countryCard}>
                <div className={styles.countryLine}>
                  <Skeleton inline width={110} height={12} />
                  <Skeleton inline width={60} height={12} />
                </div>
                <div className={`${shared.small} ${shared.muted}`}>
                  <Skeleton inline width={170} height={11} />
                </div>
                <Skeleton height={6} pill />
              </div>
            }
          />
        </TrayCard>
      </div>
    </PageSkeleton>
  );
}
