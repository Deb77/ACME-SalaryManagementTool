import { permissionKeys } from '@acme/shared';
import { IconUserPlus } from '@tabler/icons-react';
import {
  DataTable,
  EmptyState,
  PageHeader,
  PageSkeleton,
  PersonCellSkeleton,
  PillButton,
  RoleCardSkeleton,
  Skeleton,
  TrayCard,
  type DataTableColumn,
} from '../../components';
import { permissionLabels } from '../../lib/format';
import { useOptionalSession } from '../../session/SessionContext';
import shared from '../shared/screen.module.css';
import styles from './Access.module.css';
import { accessLayoutFor } from './accessLayout';

const memberColumns: DataTableColumn<never>[] = [
  {
    key: 'person',
    width: 'auto',
    title: 'Person',
    render: () => null,
    skeleton: <PersonCellSkeleton nameWidth={120} detailWidth={180} />,
  },
  {
    key: 'role',
    width: '14%',
    title: 'Role',
    render: () => null,
    skeleton: <Skeleton inline width={90} height={24} pill />,
  },
  {
    key: 'countries',
    width: '24%',
    title: 'Countries',
    render: () => null,
    skeleton: (
      <div className={styles.chips}>
        <Skeleton width={56} height={24} pill />
        <Skeleton width={64} height={24} pill />
      </div>
    ),
  },
  { key: 'lastActive', width: '15%', title: 'Last active', render: () => null },
  {
    key: 'action',
    width: 136,
    title: <span className="visually-hidden">Action</span>,
    align: 'right',
    render: () => null,
    skeleton: <Skeleton width={56} height={36} pill className={styles.skeletonEnd} />,
  },
];

const LOG_WIDTHS = [320, 260, 360];
const permissionLabelList = permissionKeys.map((key) => permissionLabels[key]);

/**
 * AccessView while roles and people load: real titles, buttons (from permissions), footers
 * and table headers; role cards, rows and log entries as placeholders.
 */
export function AccessSkeleton() {
  // Before the session loads (first page load), assume everything is visible.
  const session = useOptionalSession();
  const allowed = session?.can ?? (() => true);
  const layout = accessLayoutFor(session?.me);
  return (
    <PageSkeleton label="Loading access…">
      <PageHeader
        title="Access & roles"
        description={
          <>
            Who can see and change salary data · <Skeleton inline width={130} height={12} />
          </>
        }
        actions={
          allowed('users:manage') && (
            <PillButton tone="primary" icon={<IconUserPlus size={16} />}>
              Invite person
            </PillButton>
          )
        }
      />
      <TrayCard
        title="Roles"
        footer="A role is a set of permissions plus a country scope. Every person has one role."
      >
        <div className={styles.roleGrid}>
          {layout.roles.map((slot, index) => (
            <RoleCardSkeleton
              key={index}
              permissions={permissionLabelList}
              hero={slot.hero}
              actions={
                slot.editable && (
                  <PillButton size="small" tabIndex={-1}>
                    Edit
                  </PillButton>
                )
              }
            />
          ))}
        </div>
      </TrayCard>
      {allowed('users:manage') && (
        <TrayCard
          title="Team members"
          flush
          extra={
            <div className={styles.filterSkeleton}>
              <Skeleton width={258} height="100%" pill />
            </div>
          }
          footer="You can't remove the last Global HR. Every access change is logged."
        >
          <DataTable<never>
            label="Team members"
            columns={memberColumns}
            rows={[]}
            rowKey={() => ''}
            total={0}
            query={{ page: 1, pageSize: 5 }}
            onQueryChange={() => {}}
            skeletonRows={layout.members}
            skeletonPager={false}
            renderCard={() => null}
            skeletonCard={
              <div className={styles.memberCard}>
                <div className={styles.memberMain}>
                  <PersonCellSkeleton nameWidth={120} detailWidth={170} />
                  <div className={styles.chips}>
                    <Skeleton inline width={90} height={24} pill />
                    <Skeleton inline width={56} height={24} pill />
                  </div>
                  <div className={`${shared.small} ${shared.muted}`}>
                    <Skeleton inline width={110} height={11} />
                  </div>
                </div>
                <Skeleton width={44} height={44} circle />
              </div>
            }
          />
        </TrayCard>
      )}
      {allowed('audit:read') && (
        <TrayCard title="Recent access changes">
          {layout.changes === 0 ? (
            <EmptyState title="No access changes yet" />
          ) : (
            <ul className={styles.log} aria-hidden="true">
              {Array.from({ length: layout.changes }, (_, index) => (
                <li key={index} className={styles.logItem}>
                  {/* In a text span, so the row is a text line's height like the real one. */}
                  <span>
                    <Skeleton inline width={LOG_WIDTHS[index % LOG_WIDTHS.length]} height={12} />
                  </span>
                  <span className={`${shared.small} ${shared.muted}`}>
                    <Skeleton inline width={70} height={11} />
                  </span>
                </li>
              ))}
            </ul>
          )}
        </TrayCard>
      )}
    </PageSkeleton>
  );
}
