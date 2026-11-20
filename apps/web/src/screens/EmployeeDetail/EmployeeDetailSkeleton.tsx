import { IconCash, IconChevronLeft } from '@tabler/icons-react';
import { useParams } from 'react-router';
import {
  AppLink,
  KeyValueList,
  PageHeader,
  PageSkeleton,
  PayRangeRowSkeleton,
  PillButton,
  Skeleton,
  TrayCard,
} from '../../components';
import { useOptionalSession } from '../../session/SessionContext';
import shared from '../shared/screen.module.css';
import styles from './EmployeeDetail.module.css';
import { HistorySkeleton } from './EmployeeDetailView';

const PROFILE: readonly [string, number][] = [
  ['Employee code', 96],
  ['Email', 180],
  ['Job title', 130],
  ['Department', 100],
  ['Hire date', 90],
  ['Country', 80],
  ['Currency', 40],
];

/**
 * EmployeeDetailView while the employee loads: the same header, cards, titles and table
 * headers, with placeholders only where the employee's data goes. The action buttons are
 * the real ones (they depend on permissions, which are already known); they assume an
 * active employee, the common case.
 */
export function EmployeeDetailSkeleton() {
  // Before the session loads (first page load), assume everything is visible.
  const can = useOptionalSession()?.can ?? (() => true);
  const { id } = useParams();
  return (
    <PageSkeleton label="Loading employee…">
      <PageHeader
        back={
          <AppLink href="/employees" className={styles.back}>
            <IconChevronLeft aria-hidden="true" size={18} />
            Employees
          </AppLink>
        }
        title={<Skeleton inline width={240} height={26} />}
        description={
          <span className={styles.subtitle}>
            <Skeleton inline width={200} height={12} />
            <Skeleton width={64} height={24} pill />
          </span>
        }
        actions={
          <>
            {can('employees:terminate') && <PillButton tone="danger">Terminate</PillButton>}
            {can('employees:write') && id && (
              <PillButton href={`/employees/${id}/edit`}>Edit details</PillButton>
            )}
            {can('salary:change') && <PillButton tone="primary">Record salary change</PillButton>}
          </>
        }
      />
      <div className={shared.twoColumns}>
        <TrayCard
          title="Current pay"
          footer={can('insights:read') ? <Skeleton inline width={240} height={12} /> : undefined}
        >
          <div className={styles.pay}>
            <span className={styles.payIcon} aria-hidden="true">
              <IconCash size={20} />
            </span>
            <div>
              <div className={styles.payValue}>
                <Skeleton inline width={150} height={24} />
              </div>
              <div className={shared.muted}>
                per year · <Skeleton inline width={32} height={12} /> · effective{' '}
                <Skeleton inline width={80} height={12} />
              </div>
            </div>
          </div>
          {can('insights:read') && (
            <div className={styles.benchmark}>
              <div className={shared.small}>
                <Skeleton inline width={190} height={11} />
              </div>
              <PayRangeRowSkeleton title="Pay range" />
              <div className={`${styles.rangeLabels} ${shared.small} ${shared.muted}`}>
                <Skeleton inline width={90} height={11} />
                <Skeleton inline width={90} height={11} />
              </div>
            </div>
          )}
        </TrayCard>
        <TrayCard title="Profile" footer="Pay currency is set by country">
          <KeyValueList
            items={PROFILE.map(([label, width]) => ({
              label,
              value: <Skeleton inline width={width} height={12} />,
            }))}
          />
        </TrayCard>
      </div>
      <TrayCard
        title="Salary history"
        flush
        extra={<span className={`${shared.small} ${shared.muted}`}>Entries are permanent</span>}
        footer={<Skeleton inline width={260} height={12} />}
      >
        <HistorySkeleton rows={4} />
      </TrayCard>
    </PageSkeleton>
  );
}
