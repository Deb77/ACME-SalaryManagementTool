import type { Story } from '@ladle/react';
import { useState } from 'react';
import { AccessSkeleton } from '../../screens/Access/AccessSkeleton';
import { AccessView, type AccessViewProps } from '../../screens/Access/AccessView';
import { EditAccessDialog } from '../../screens/Access/EditAccessDialog';
import { InviteDialog } from '../../screens/Access/InviteDialog';
import { RoleEditorDialog } from '../../screens/Access/RoleEditorDialog';
import {
  sampleAccessChanges,
  sampleMeCountry,
  sampleMeGlobal,
  sampleMeta,
  samplePermissions,
  sampleRoles,
  sampleUsers,
} from '../screenSampleData';
import { ScreenFrame } from './ScreenFrame';

export default { title: 'Screens / Access & roles' };

const now = new Date('2026-11-20T12:00:00.000Z');

function Access(overrides: Partial<AccessViewProps>) {
  const [roleFilter, setRoleFilter] = useState('all');
  return (
    <AccessView
      me={sampleMeGlobal}
      roles={sampleRoles}
      users={sampleUsers}
      countries={sampleMeta.countries}
      roleFilter={roleFilter}
      onRoleFilterChange={setRoleFilter}
      accessChanges={sampleAccessChanges}
      onInvite={() => {}}
      onEditUser={() => {}}
      onEditRole={() => {}}
      onDeleteRole={() => {}}
      now={now}
      {...overrides}
    />
  );
}

export const GlobalHr: Story = () => (
  <ScreenFrame me={sampleMeGlobal} path="/access">
    <Access />
  </ScreenFrame>
);
GlobalHr.storyName = 'Global HR';
GlobalHr.meta = { fullscreen: true };

/** The page until roles, people and recent changes have all loaded; matches Global HR. */
export const Loading: Story = () => (
  <ScreenFrame me={sampleMeGlobal} path="/access">
    <AccessSkeleton />
  </ScreenFrame>
);
Loading.meta = { fullscreen: true };

const countryManager = {
  ...sampleMeCountry,
  permissions: [...sampleMeCountry.permissions, 'users:manage' as const],
};

export const CountryUserManager: Story = () => (
  <ScreenFrame me={countryManager} path="/access">
    <Access me={countryManager} accessChanges={undefined} />
  </ScreenFrame>
);
CountryUserManager.storyName = 'Country user manager (no audit)';
CountryUserManager.meta = { fullscreen: true };

export const EditAccess: Story = () => (
  <EditAccessDialog
    me={sampleMeGlobal}
    user={sampleUsers[2]!}
    roles={sampleRoles}
    countries={sampleMeta.countries}
    isLastGlobalHr={false}
    onSave={() => {}}
    onRemoveAccess={() => {}}
    onRestoreAccess={() => {}}
    onSendNewLink={() => {}}
    onCancel={() => {}}
  />
);
EditAccess.storyName = 'Edit access (sheet on phones)';

export const GiveAccessBack: Story = () => (
  <EditAccessDialog
    me={sampleMeGlobal}
    user={{ ...sampleUsers[4]!, status: 'deactivated', lastSignInAt: null }}
    roles={sampleRoles}
    countries={sampleMeta.countries}
    isLastGlobalHr={false}
    onSave={() => {}}
    onRemoveAccess={() => {}}
    onRestoreAccess={() => {}}
    onSendNewLink={() => {}}
    onCancel={() => {}}
  />
);
GiveAccessBack.storyName = 'Give access back (access removed)';

export const EditLastGlobalHr: Story = () => (
  <EditAccessDialog
    me={sampleMeGlobal}
    user={sampleUsers[0]!}
    roles={sampleRoles}
    countries={sampleMeta.countries}
    isLastGlobalHr
    onSave={() => {}}
    onRemoveAccess={() => {}}
    onRestoreAccess={() => {}}
    onSendNewLink={() => {}}
    onCancel={() => {}}
  />
);
EditLastGlobalHr.storyName = 'Edit access, last Global HR';

export const Invite: Story = () => (
  <InviteDialog
    me={sampleMeGlobal}
    roles={sampleRoles}
    countries={sampleMeta.countries}
    onInvite={() => {}}
    onClose={() => {}}
  />
);

export const InviteSent: Story = () => (
  <InviteDialog
    me={sampleMeGlobal}
    roles={sampleRoles}
    countries={sampleMeta.countries}
    inviteUrl="https://people.acme.com/invite/3f9c2a7e"
    onInvite={() => {}}
    onClose={() => {}}
  />
);
InviteSent.storyName = 'Invite sent (link shown once)';

export const NewRole: Story = () => (
  <RoleEditorDialog
    me={sampleMeGlobal}
    catalogue={samplePermissions}
    onSubmit={() => {}}
    onCancel={() => {}}
  />
);

export const EditRole: Story = () => (
  <RoleEditorDialog
    me={sampleMeGlobal}
    role={sampleRoles[2]}
    catalogue={samplePermissions}
    onSubmit={() => {}}
    onCancel={() => {}}
  />
);
