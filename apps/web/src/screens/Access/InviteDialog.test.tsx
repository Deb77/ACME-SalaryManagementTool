import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { sampleMeGlobal, sampleMeta, sampleRoles } from '../../stories/screenSampleData';
import { render, screen, waitFor } from '../../test/render';
import { InviteDialog, type InviteDialogProps } from './InviteDialog';

const props = (overrides: Partial<InviteDialogProps> = {}): InviteDialogProps => ({
  me: sampleMeGlobal,
  roles: sampleRoles,
  countries: sampleMeta.countries,
  onInvite: vi.fn(),
  onClose: vi.fn(),
  ...overrides,
});

describe('InviteDialog', () => {
  it('opens with focus on the name field', async () => {
    render(<InviteDialog {...props()} />);

    await waitFor(() => expect(screen.getByLabelText(/Name/)).toHaveFocus());
  });

  it('explains missing fields in plain words and focuses the first one', async () => {
    const onInvite = vi.fn();
    render(<InviteDialog {...props({ onInvite })} />);

    await userEvent.click(screen.getByRole('button', { name: 'Create invite' }));

    expect(onInvite).not.toHaveBeenCalled();
    expect(screen.getByText('Enter a name')).toBeInTheDocument();
    expect(screen.getByText('Enter a work email')).toBeInTheDocument();
    expect(screen.getByText('Choose at least one country')).toBeInTheDocument();
    expect(screen.queryByText(/Too small|Invalid/)).not.toBeInTheDocument();
    expect(screen.getByLabelText(/Name/)).toHaveFocus();
  });

  it('asks for a well-formed email', async () => {
    render(<InviteDialog {...props()} />);

    await userEvent.type(screen.getByLabelText(/Name/), 'Ravi Menon');
    await userEvent.type(screen.getByLabelText(/Work email/), 'ravi');
    await userEvent.click(screen.getByRole('button', { name: 'Create invite' }));

    expect(screen.getByText('Enter an email address like name@acme.com')).toBeInTheDocument();
    expect(screen.getByLabelText(/Work email/)).toHaveFocus();
  });

  it('titles a replacement link for the person and says the old one stops working', () => {
    render(
      <InviteDialog
        {...props({
          inviteUrl: 'https://example.test/accept-invite#token=x',
          invitee: 'Wei Ling Tan',
        })}
      />,
    );

    expect(screen.getByRole('dialog', { name: 'New link for Wei Ling Tan' })).toBeInTheDocument();
    expect(screen.getByText(/Any earlier link no longer works/)).toBeInTheDocument();
  });
});
