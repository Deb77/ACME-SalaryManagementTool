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
import { render, screen, within } from '../../test/render';
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
  onEditRole: vi.fn(),
  onDeleteRole: vi.fn(),
  now: new Date('2026-11-20T12:00:00.000Z'),
  ...overrides,
});

describe('AccessView', () => {
  it('lets Global HR invite people and edit access, with no way to add a role', async () => {
    const onInvite = vi.fn();
    const onEditUser = vi.fn();
    render(<AccessView {...props({ onInvite, onEditUser })} />);

    await userEvent.click(screen.getByRole('button', { name: /Invite person/ }));
    expect(onInvite).toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: /New role/ })).not.toBeInTheDocument();
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

  it('counts the same people on the role card and in the role filter', () => {
    const countryRole = sampleRoles[1]!;
    const users = [
      ...sampleUsers.filter((u) => u.role.id !== countryRole.id),
      { ...sampleUsers[2]!, id: 'a', name: 'Active One' },
      { ...sampleUsers[2]!, id: 'b', name: 'Invited One', status: 'invited' as const },
      {
        ...sampleUsers[2]!,
        id: 'c',
        name: 'Gone One',
        status: 'deactivated' as const,
        countries: [],
      },
    ];
    // The API's count leaves out people without access; the card follows the team list instead.
    render(
      <AccessView
        {...props({ users, roles: [sampleRoles[0]!, { ...countryRole, userCount: 2 }] })}
      />,
    );

    expect(screen.getByText(/· 1 invited · 1 without access/)).toHaveTextContent(
      '3 people · 1 invited · 1 without access · System role',
    );
    expect(screen.getByRole('radio', { name: 'Country HR 3' })).toBeInTheDocument();
  });

  it('marks people without access and without countries apart from the country chips', () => {
    const users = [
      {
        ...sampleUsers[2]!,
        id: 'c',
        name: 'Gone One',
        status: 'deactivated' as const,
        countries: [],
      },
    ];
    render(<AccessView {...props({ users })} />);

    const card = within(screen.getByRole('list', { name: 'Team members' })).getByRole('listitem');
    expect(within(card).getByText('No access')).toBeInTheDocument();
    expect(within(card).getByText('No countries')).toBeInTheDocument();
  });

  it('offers to give access back to someone whose access was removed, and logs it in words', async () => {
    const onEditUser = vi.fn();
    const removed = { ...sampleUsers[4]!, status: 'deactivated' as const };
    const restore = {
      ...sampleAccessChanges[0]!,
      id: '00000000-0000-4000-8000-0000000000ff',
      action: 'user.updated' as const,
      entity: { type: 'user', id: removed.id, label: removed.name },
      before: { status: 'deactivated' },
      after: { status: 'active' },
    };
    render(
      <AccessView
        {...props({
          users: sampleUsers.map((u) => (u.id === removed.id ? removed : u)),
          accessChanges: [restore],
          onEditUser,
        })}
      />,
    );

    expect(
      screen.queryByRole('button', { name: `Edit access for ${removed.name}` }),
    ).not.toBeInTheDocument();
    await userEvent.click(
      screen.getByRole('button', { name: `Give access back to ${removed.name}` }),
    );
    expect(onEditUser).toHaveBeenCalledWith(removed);
    expect(
      screen.getByText(`${restore.actor.name} gave access back to ${removed.name}`),
    ).toBeInTheDocument();
  });
});
