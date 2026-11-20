import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import {
  sampleAccessChanges,
  sampleMeCountry,
  sampleMeGlobal,
  sampleMeta,
  sampleRoles,
  sampleUsers,
} from '../../stories/screenSampleData';
import { render, screen } from '../../test/render';
import { AccessView, type AccessViewProps } from './AccessView';

const props = (overrides: Partial<AccessViewProps> = {}): AccessViewProps => ({
  me: sampleMeGlobal,
  roles: sampleRoles,
  users: sampleUsers,
  countries: sampleMeta.countries,
  roleFilter: 'all',
  onRoleFilterChange: vi.fn(),
  accessChanges: sampleAccessChanges,
  onInvite: vi.fn(),
  onEditUser: vi.fn(),
  onNewRole: vi.fn(),
  onEditRole: vi.fn(),
  onDeleteRole: vi.fn(),
  now: new Date('2026-11-20T12:00:00.000Z'),
  ...overrides,
});

describe('AccessView', () => {
  it('lets Global HR invite people, create roles and edit access', async () => {
    const onInvite = vi.fn();
    const onEditUser = vi.fn();
    render(<AccessView {...props({ onInvite, onEditUser })} />);

    await userEvent.click(screen.getByRole('button', { name: /Invite person/ }));
    expect(onInvite).toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /New role/ })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Edit access for Ananya Rao' }));
    expect(onEditUser).toHaveBeenCalledWith(sampleUsers[2]);
    expect(screen.getByText('Recent access changes')).toBeInTheDocument();
  });

  it('shows only roles to someone who cannot manage users, and no audit without audit:read', () => {
    render(
      <AccessView
        {...props({
          me: { ...sampleMeCountry, permissions: ['employees:read', 'roles:manage'] },
          users: undefined,
          accessChanges: undefined,
        })}
      />,
    );

    expect(screen.queryByRole('button', { name: /Invite person/ })).not.toBeInTheDocument();
    expect(screen.queryByText('Team members')).not.toBeInTheDocument();
    expect(screen.queryByText('Recent access changes')).not.toBeInTheDocument();
  });

  it('never offers to delete a system role', () => {
    render(<AccessView {...props()} />);

    const systemRoles = sampleRoles.filter((role) => role.isSystem);
    expect(screen.queryAllByRole('button', { name: 'Delete' })).toHaveLength(
      sampleRoles.length -
        systemRoles.length -
        sampleRoles.filter((r) => !r.isSystem && r.userCount > 0).length,
    );
  });
});
