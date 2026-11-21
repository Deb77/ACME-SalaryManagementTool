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
});
