import type { Role, User } from '@acme/shared';
import { useEffect, useState } from 'react';
import { describeError } from '../../api/client';
import {
  createRole,
  deactivateUser,
  deleteRole,
  inviteUser,
  listAccessChanges,
  listPermissions,
  listRoles,
  listUsers,
  reactivateUser,
  reissueInvite,
  updateRole,
  updateUser,
} from '../../api/endpoints';
import { useResource } from '../../api/useResource';
import { ConfirmDialog, ErrorState } from '../../components';
import { isLastActiveGlobalHr } from '../../session/permissions';
import { useSession } from '../../session/SessionContext';
import { AccessView } from './AccessView';
import { EditAccessDialog } from './EditAccessDialog';
import { InviteDialog } from './InviteDialog';
import { RoleEditorDialog } from './RoleEditorDialog';
import { AccessSkeleton } from './AccessSkeleton';
import { rememberAccessLayout } from './accessLayout';

type Open =
  | { kind: 'invite'; inviteUrl?: string; invitee?: string }
  | { kind: 'edit-user'; user: User }
  | { kind: 'remove-user'; user: User }
  | { kind: 'role'; role?: Role }
  | { kind: 'delete-role'; role: Role }
  | null;

/** Container for Access & roles: users, roles, the permission catalogue and recent changes. */
export function AccessScreen() {
  const { me, meta, can } = useSession();
  const roles = useResource('roles', (signal) => listRoles({ signal }));
  const users = useResource(can('users:manage') ? 'users' : null, (signal) =>
    listUsers({ signal }),
  );
  const catalogue = useResource(can('roles:manage') ? 'permissions' : null, (signal) =>
    listPermissions({ signal }),
  );
  const changes = useResource(can('audit:read') ? 'access-changes' : null, (signal) =>
    listAccessChanges({ signal }),
  );
  const [roleFilter, setRoleFilter] = useState('all');
  const [open, setOpen] = useState<Open>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();
  const [shown, setShown] = useState(false);
  // The next visit's skeleton draws the same page: role cards, member rows and changes.
  useEffect(() => {
    if (roles.data) {
      rememberAccessLayout(
        me,
        roles.data.items,
        users.data?.items.length ?? 0,
        changes.data?.items.length ?? 0,
      );
    }
  }, [me, roles.data, users.data, changes.data]);

  const failed = [roles, users].find((r) => r.status === 'error');
  if (failed) {
    return (
      <ErrorState
        title="Access could not load"
        description={describeError(failed.error)}
        onRetry={failed.reload}
      />
    );
  }
  // First load: the page appears once, with the recent changes, instead of that card popping in.
  const settled = (r: { status: string }) => r.status === 'success' || r.status === 'error';
  const allLoaded =
    roles.data !== undefined &&
    (!can('users:manage') || users.data !== undefined) &&
    (!can('audit:read') || settled(changes));
  if (allLoaded && !shown) setShown(true);
  if (!roles.data || (can('users:manage') && !users.data) || (!shown && !allLoaded)) {
    return <AccessSkeleton />;
  }

  const allRoles = roles.data.items;
  const allUsers = users.data?.items ?? [];
  const close = () => {
    setOpen(null);
    setError(undefined);
  };
  /** Runs a write, then reloads what it changed; errors stay in the open dialog. */
  const run = async (write: () => Promise<unknown>, after?: () => void) => {
    setSaving(true);
    setError(undefined);
    try {
      await write();
      roles.reload();
      users.reload();
      changes.reload();
      (after ?? close)();
    } catch (caught) {
      setError(describeError(caught));
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <AccessView
        me={me}
        roles={allRoles}
        users={users.data?.items}
        countries={meta.countries}
        roleFilter={roleFilter}
        onRoleFilterChange={setRoleFilter}
        accessChanges={changes.data?.items}
        onInvite={() => setOpen({ kind: 'invite' })}
        onEditUser={(user) => setOpen({ kind: 'edit-user', user })}
        onNewRole={() => setOpen({ kind: 'role' })}
        onEditRole={(role) => setOpen({ kind: 'role', role })}
        onDeleteRole={(role) => setOpen({ kind: 'delete-role', role })}
      />
      {open?.kind === 'invite' && (
        <InviteDialog
          me={me}
          roles={allRoles}
          countries={meta.countries}
          saving={saving}
          error={error}
          inviteUrl={open.inviteUrl}
          invitee={open.invitee}
          onClose={close}
          onInvite={(body) => {
            void run(
              async () => {
                const { inviteUrl } = await inviteUser(body);
                setOpen({ kind: 'invite', inviteUrl });
              },
              () => {},
            );
          }}
        />
      )}
      {open?.kind === 'edit-user' && (
        <EditAccessDialog
          me={me}
          user={open.user}
          roles={allRoles}
          countries={meta.countries}
          isLastGlobalHr={isLastActiveGlobalHr(open.user, allUsers)}
          saving={saving}
          error={error}
          onCancel={close}
          onRemoveAccess={() => setOpen({ kind: 'remove-user', user: open.user })}
          onRestoreAccess={(change) => {
            const { user } = open;
            void run(
              async () => {
                const changed =
                  change.roleId !== user.role.id ||
                  change.countries.join() !== user.countries.join();
                if (changed) await updateUser(user.id, { ...change, version: user.version });
                const restored = await reactivateUser(user.id);
                // Someone who never set a password is invited again and needs a fresh link.
                if (restored.status === 'invited') {
                  const { inviteUrl } = await reissueInvite(user.id);
                  setOpen({ kind: 'invite', inviteUrl, invitee: user.name });
                } else {
                  close();
                }
              },
              () => {},
            );
          }}
          onSendNewLink={() => {
            const { user } = open;
            void run(
              async () => {
                const { inviteUrl } = await reissueInvite(user.id);
                setOpen({ kind: 'invite', inviteUrl, invitee: user.name });
              },
              () => {},
            );
          }}
          onSave={(change) =>
            void run(() => updateUser(open.user.id, { ...change, version: open.user.version }))
          }
        />
      )}
      {open?.kind === 'remove-user' && (
        <ConfirmDialog
          open
          danger
          title={`Remove access for ${open.user.name}?`}
          description={
            error ??
            'They are signed out at once and cannot sign in again. Their past changes stay in the audit log. You can restore access later.'
          }
          confirmLabel="Remove access"
          loading={saving}
          onCancel={close}
          onConfirm={() => void run(() => deactivateUser(open.user.id))}
        />
      )}
      {open?.kind === 'role' && catalogue.data && (
        <RoleEditorDialog
          me={me}
          role={open.role}
          catalogue={catalogue.data.items}
          saving={saving}
          error={error}
          onCancel={close}
          onSubmit={(submit) =>
            void run(() =>
              submit.mode === 'create'
                ? createRole(submit.body)
                : updateRole(open.role?.id ?? '', submit.body),
            )
          }
        />
      )}
      {open?.kind === 'delete-role' && (
        <ConfirmDialog
          open
          danger
          title={`Delete ${open.role.name}?`}
          description={error ?? 'Nobody holds this role, so deleting it changes no one’s access.'}
          confirmLabel="Delete role"
          loading={saving}
          onCancel={close}
          onConfirm={() => void run(() => deleteRole(open.role.id))}
        />
      )}
    </>
  );
}
