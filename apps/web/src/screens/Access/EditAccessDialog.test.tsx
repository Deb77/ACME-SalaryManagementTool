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
        onCancel={vi.fn()}
      />,
    );

    expect(
      screen.getByRole('group', { name: 'Countries this person can see and edit' }),
    ).toBeInTheDocument();
    expect(screen.getByText(/They will see employees in 1 country\./)).toBeInTheDocument();
    expect(screen.queryByText(/India will see|Countries India/)).not.toBeInTheDocument();
  });
});
