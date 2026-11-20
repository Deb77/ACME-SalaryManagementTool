import type { AuditEvent, CountryInfo, Me, Role, User } from '@acme/shared';
import { permissionKeys } from '@acme/shared';
import { IconPencil, IconPlus, IconUserPlus } from '@tabler/icons-react';
import {
  DataTable,
  EmptyState,
  IconButton,
  PageHeader,
  PersonCell,
  PillButton,
  RoleCard,
  SegmentedControl,
  StatusTag,
  TrayCard,
  type DataTableColumn,
} from '../../components';
import { formatRelative, permissionLabels } from '../../lib/format';
import {
  accessEditRules,
  canDeleteRole,
  canEditAccess,
  canEditRole,
} from '../../session/permissions';
import shared from '../shared/screen.module.css';
import styles from './Access.module.css';

export interface AccessViewProps {
  me: Me;
  roles: readonly Role[];
  /** Omitted without `users:manage`. */
  users?: readonly User[];
  countries: readonly CountryInfo[];
  roleFilter: string;
  onRoleFilterChange: (roleId: string) => void;
  /** Omitted without `audit:read`. */
  accessChanges?: readonly AuditEvent[];
  onInvite: () => void;
  onEditUser: (user: User) => void;
  onNewRole: () => void;
  onEditRole: (role: Role) => void;
  onDeleteRole: (role: Role) => void;
  /** Fixed "now" for relative times (stories and tests). */
  now?: Date;
}

const ACTION_VERBS: Partial<Record<AuditEvent['action'], string>> = {
  'user.invited': 'invited',
  'user.updated': 'changed access for',
  'user.deactivated': 'removed access for',
  'role.created': 'created the role',
  'role.updated': 'changed the role',
  'role.deleted': 'deleted the role',
};

function scopeText(role: Pick<Role, 'countryScope'>) {
  return role.countryScope === 'all' ? 'All countries' : 'Only the countries assigned to them';
}

/** Access & roles: the roles (permission sets plus a country scope) and who holds them. */
export function AccessView({
  me,
  roles,
  users,
  countries,
  roleFilter,
  onRoleFilterChange,
  accessChanges,
  onInvite,
  onEditUser,
  onNewRole,
  onEditRole,
  onDeleteRole,
  now,
}: AccessViewProps) {
  const canManageUsers = me.permissions.includes('users:manage');
  const canManageRoles = me.permissions.includes('roles:manage');
  const countryName = (code: string) => countries.find((c) => c.code === code)?.name ?? code;
  const roleById = new Map(roles.map((role) => [role.id, role]));
  const shownUsers = (users ?? []).filter((u) => roleFilter === 'all' || u.role.id === roleFilter);

  const countryChips = (user: User) => {
    const role = roleById.get(user.role.id);
    if (role?.countryScope === 'all') return [<StatusTag key="all">All countries</StatusTag>];
    return user.countries.map((code) => <StatusTag key={code}>{countryName(code)}</StatusTag>);
  };

  const lastActive = (user: User) =>
    user.status === 'invited' ? (
      <StatusTag tone="warning">Invite pending</StatusTag>
    ) : user.status === 'deactivated' ? (
      <StatusTag tone="neutral">No access</StatusTag>
    ) : user.lastSignInAt ? (
      formatRelative(user.lastSignInAt, now)
    ) : (
      'Never signed in'
    );

  const editButton = (user: User, compact: boolean) => {
    const rules = accessEditRules(me, user, users ?? [], roles);
    if (!canEditAccess(rules)) return null;
    return compact ? (
      <IconButton
        label={`Edit access for ${user.name}`}
        icon={<IconPencil size={18} />}
        onClick={() => onEditUser(user)}
      />
    ) : (
      <PillButton
        size="small"
        aria-label={`Edit access for ${user.name}`}
        onClick={() => onEditUser(user)}
      >
        Edit
      </PillButton>
    );
  };

  const displayName = (user: User) => (user.id === me.id ? `${user.name} (you)` : user.name);

  const columns: DataTableColumn<User>[] = [
    {
      key: 'person',
      width: '30%',
      title: 'Person',
      render: (user) => <PersonCell name={displayName(user)} detail={user.email} />,
    },
    {
      key: 'role',
      width: '15%',
      title: 'Role',
      render: (user) => (
        <StatusTag tone={user.role.key === 'global_hr' ? 'success' : 'info'}>
          {user.role.name}
        </StatusTag>
      ),
    },
    {
      key: 'countries',
      width: '27%',
      title: 'Countries',
      render: (user) => <div className={styles.chips}>{countryChips(user)}</div>,
    },
    { key: 'lastActive', width: '17%', title: 'Last active', render: lastActive },
    {
      key: 'action',
      width: '11%',
      title: <span className="visually-hidden">Action</span>,
      align: 'right',
      render: (user) => editButton(user, false),
    },
  ];

  return (
    <>
      <PageHeader
        title="Access & roles"
        description={`Who can see and change salary data${users ? ` · ${users.length} people` : ''} · ${roles.length} roles`}
        actions={
          canManageUsers && (
            <PillButton tone="primary" icon={<IconUserPlus size={16} />} onClick={onInvite}>
              Invite person
            </PillButton>
          )
        }
      />

      <TrayCard
        title="Roles"
        extra={
          canManageRoles && (
            <PillButton size="small" icon={<IconPlus size={14} />} onClick={onNewRole}>
              New role
            </PillButton>
          )
        }
        footer="A role is a set of permissions plus a country scope. Every person has one role."
      >
        <div className={styles.roleGrid}>
          {roles.map((role) => (
            <RoleCard
              key={role.id}
              name={role.name}
              scope={scopeText(role)}
              badge={
                role.key === 'global_hr'
                  ? 'Full access'
                  : role.countryScope === 'all'
                    ? 'All countries'
                    : 'Scoped'
              }
              hero={role.key === 'global_hr'}
              permissions={permissionKeys.map((key) => ({
                label: permissionLabels[key],
                allowed: role.permissions.includes(key),
              }))}
              footer={
                <>
                  <strong>{role.userCount}</strong> {role.userCount === 1 ? 'person' : 'people'}
                  {role.isSystem ? ' · System role' : ''}
                </>
              }
              actions={
                (canEditRole(me, role) || canDeleteRole(me, role)) && (
                  <>
                    {canDeleteRole(me, role) && (
                      <PillButton size="small" tone="danger" onClick={() => onDeleteRole(role)}>
                        Delete
                      </PillButton>
                    )}
                    {canEditRole(me, role) && (
                      <PillButton
                        size="small"
                        aria-label={`Edit role ${role.name}`}
                        onClick={() => onEditRole(role)}
                      >
                        Edit
                      </PillButton>
                    )}
                  </>
                )
              }
            />
          ))}
        </div>
      </TrayCard>

      {users && (
        <TrayCard
          title="Team members"
          flush
          extra={
            <div className={styles.filter}>
              <SegmentedControl
                label="Filter by role"
                size="small"
                options={[
                  { value: 'all', label: `All ${users.length}` },
                  ...roles
                    .filter((role) => role.userCount > 0)
                    .map((role) => ({
                      value: role.id,
                      label: `${role.name} ${users.filter((u) => u.role.id === role.id).length}`,
                    })),
                ]}
                value={roleFilter}
                onChange={onRoleFilterChange}
              />
            </div>
          }
          footer="You can't remove the last Global HR. Every access change is logged."
        >
          <DataTable
            label="Team members"
            columns={columns}
            rows={shownUsers}
            rowKey={(user) => user.id}
            total={shownUsers.length}
            query={{ page: 1, pageSize: Math.max(1, shownUsers.length) }}
            onQueryChange={() => {}}
            itemName="people"
            empty={<EmptyState title="Nobody holds this role" />}
            renderCard={(user) => (
              <div className={styles.memberCard}>
                <div className={styles.memberMain}>
                  <PersonCell name={displayName(user)} detail={user.email} />
                  <div className={styles.chips}>
                    <StatusTag tone={user.role.key === 'global_hr' ? 'success' : 'info'}>
                      {user.role.name}
                    </StatusTag>
                    {countryChips(user)}
                  </div>
                  <div className={`${shared.small} ${shared.muted}`}>{lastActive(user)}</div>
                </div>
                {editButton(user, true)}
              </div>
            )}
          />
        </TrayCard>
      )}

      {accessChanges && (
        <TrayCard title="Recent access changes">
          {accessChanges.length === 0 ? (
            <EmptyState title="No access changes yet" />
          ) : (
            <ul className={styles.log}>
              {accessChanges.map((event) => (
                <li key={event.id} className={styles.logItem}>
                  <span>
                    {event.actor.name} {ACTION_VERBS[event.action] ?? event.action}{' '}
                    {event.entity.label}
                  </span>
                  <span className={`${shared.small} ${shared.muted}`}>
                    {formatRelative(event.occurredAt, now)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </TrayCard>
      )}
    </>
  );
}
