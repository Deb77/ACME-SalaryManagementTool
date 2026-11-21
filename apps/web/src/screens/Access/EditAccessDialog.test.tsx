import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import {
  sampleMeGlobal,
  sampleMeta,
  sampleRoles,
  sampleUsers,
} from '../../stories/screenSampleData';
import { render, screen } from '../../test/render';
import { EditAccessDialog } from './EditAccessDialog';

describe('EditAccessDialog', () => {
  it('words the countries for any name, not its first word', () => {
    const user = { ...sampleUsers[2]!, name: 'India HR (demo)' };
    render(
      <EditAccessDialog
        me={sampleMeGlobal}
        user={user}
        roles={sampleRoles}
        countries={sampleMeta.countries}
        isLastGlobalHr={false}
        onSave={vi.fn()}
        onRemoveAccess={vi.fn()}
        onRestoreAccess={vi.fn()}
        onSendNewLink={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect(
      screen.getByRole('group', { name: 'Countries this person can see and edit' }),
    ).toBeInTheDocument();
    expect(screen.getByText(/They will see employees in 1 country\./)).toBeInTheDocument();
    expect(screen.queryByText(/India will see|Countries India/)).not.toBeInTheDocument();
  });

  it('gives access back to someone whose access was removed, with the chosen role', async () => {
    const user = { ...sampleUsers[2]!, status: 'deactivated' as const };
    const onRestoreAccess = vi.fn();
    const onSave = vi.fn();
    render(
      <EditAccessDialog
        me={sampleMeGlobal}
        user={user}
        roles={sampleRoles}
        countries={sampleMeta.countries}
        isLastGlobalHr={false}
        onSave={onSave}
        onRemoveAccess={vi.fn()}
        onRestoreAccess={onRestoreAccess}
        onSendNewLink={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect(screen.getByRole('dialog', { name: 'Give access back' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Remove access' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Give access back' }));
    expect(onRestoreAccess).toHaveBeenCalledWith({
      roleId: user.role.id,
      countries: user.countries,
    });
    expect(onSave).not.toHaveBeenCalled();
  });

  function renderFor(user: (typeof sampleUsers)[number], onSendNewLink = vi.fn()) {
    render(
      <EditAccessDialog
        me={sampleMeGlobal}
        user={user}
        roles={sampleRoles}
        countries={sampleMeta.countries}
        isLastGlobalHr={false}
        onSave={vi.fn()}
        onRemoveAccess={vi.fn()}
        onRestoreAccess={vi.fn()}
        onSendNewLink={onSendNewLink}
        onCancel={vi.fn()}
      />,
    );
    return onSendNewLink;
  }

  it('sends a new invite link to someone who has not used theirs', async () => {
    const invited = sampleUsers.find((u) => u.status === 'invited')!;
    const onSendNewLink = renderFor(invited);

    expect(screen.getByText(/has not set a password yet/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Send new link' }));
    expect(onSendNewLink).toHaveBeenCalledTimes(1);
  });

  it('offers a new sign-in link to an active person who forgot their password', () => {
    renderFor(sampleUsers[2]!);

    expect(screen.getByRole('button', { name: 'Send new link' })).toBeInTheDocument();
    expect(
      screen.getByText(/signs them out and lets them choose a new password/),
    ).toBeInTheDocument();
  });

  it('offers no new link for your own account or someone without access', () => {
    renderFor(sampleUsers[0]!); // Riya Kapoor is sampleMeGlobal
    expect(screen.queryByRole('button', { name: 'Send new link' })).not.toBeInTheDocument();
  });

  it('offers no new link to someone whose access was removed', () => {
    renderFor({ ...sampleUsers[2]!, status: 'deactivated' });
    expect(screen.queryByRole('button', { name: 'Send new link' })).not.toBeInTheDocument();
  });
});
