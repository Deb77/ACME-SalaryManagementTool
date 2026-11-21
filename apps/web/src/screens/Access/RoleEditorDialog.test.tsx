import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { sampleMeGlobal, samplePermissions } from '../../stories/screenSampleData';
import { render, screen } from '../../test/render';
import { RoleEditorDialog, type RoleEditorDialogProps } from './RoleEditorDialog';

const props = (overrides: Partial<RoleEditorDialogProps> = {}): RoleEditorDialogProps => ({
  me: sampleMeGlobal,
  catalogue: samplePermissions,
  onSubmit: vi.fn(),
  onCancel: vi.fn(),
  ...overrides,
});

describe('RoleEditorDialog', () => {
  it('asks for a name in plain words and focuses it', async () => {
    const onSubmit = vi.fn();
    render(<RoleEditorDialog {...props({ onSubmit })} />);

    await userEvent.click(screen.getByRole('button', { name: 'Create role' }));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText('Enter a name')).toBeInTheDocument();
    expect(screen.queryByText(/Too small/)).not.toBeInTheDocument();
    expect(screen.getByLabelText(/Name/)).toHaveFocus();
  });
});
