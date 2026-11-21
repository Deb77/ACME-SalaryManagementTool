import { useState } from 'react';
import { render, screen, waitFor } from '../../../test/render';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Dialog } from './Dialog';

describe('Dialog', () => {
  it('is a dialog named by its title with the footer note and actions', () => {
    render(
      <Dialog
        open
        title="Record salary change"
        onClose={vi.fn()}
        footerNote="Saved changes are permanent"
        actions={<button>Save change</button>}
      >
        form
      </Dialog>,
    );

    const dialog = screen.getByRole('dialog', { name: 'Record salary change' });
    expect(dialog).toHaveTextContent('Saved changes are permanent');
    expect(screen.getByRole('button', { name: 'Save change' })).toBeInTheDocument();
  });

  it('closes on Escape', async () => {
    const onClose = vi.fn();
    render(
      <Dialog open title="Record salary change" onClose={onClose}>
        form
      </Dialog>,
    );

    await userEvent.keyboard('{Escape}');

    expect(onClose).toHaveBeenCalled();
  });

  it('cannot be dismissed while busy', () => {
    render(
      <Dialog open busy title="Record salary change" onClose={vi.fn()}>
        form
      </Dialog>,
    );

    expect(screen.queryByRole('button', { name: 'Close' })).not.toBeInTheDocument();
  });

  it('renders nothing when closed', () => {
    render(
      <Dialog open={false} title="Record salary change" onClose={vi.fn()}>
        form
      </Dialog>,
    );

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('starts focus on the first enabled field rather than the close button', async () => {
    render(
      <Dialog open title="Invite person" onClose={vi.fn()}>
        <input aria-label="Disabled" disabled />
        <input aria-label="Name" />
        <input aria-label="Email" />
      </Dialog>,
    );

    await waitFor(() => expect(screen.getByRole('textbox', { name: 'Name' })).toHaveFocus());
  });

  it('keeps the default focus when there are no fields', async () => {
    render(
      <Dialog open title="Remove access?" onClose={vi.fn()} actions={<button>Remove</button>}>
        They lose access straight away.
      </Dialog>,
    );

    await waitFor(() => expect(screen.getByRole('button', { name: 'Close' })).toHaveFocus());
  });

  it('returns focus to the opener when a screen unmounts it', async () => {
    function Screen() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <button onClick={() => setOpen(true)}>Record salary change</button>
          {open && (
            <Dialog open title="Record salary change" onClose={() => setOpen(false)}>
              <input aria-label="Amount" />
            </Dialog>
          )}
        </>
      );
    }
    render(<Screen />);
    const opener = screen.getByRole('button', { name: 'Record salary change' });

    await userEvent.click(opener);
    await waitFor(() => expect(screen.getByRole('textbox', { name: 'Amount' })).toHaveFocus());
    await userEvent.keyboard('{Escape}');

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await waitFor(() => expect(opener).toHaveFocus());
  });

  it('returns focus to the opener when it closes while staying mounted', async () => {
    function Screen() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <button onClick={() => setOpen(true)}>Open</button>
          <Dialog open={open} title="Edit access" onClose={() => setOpen(false)}>
            <input aria-label="Name" />
          </Dialog>
        </>
      );
    }
    render(<Screen />);
    const opener = screen.getByRole('button', { name: 'Open' });

    await userEvent.click(opener);
    await waitFor(() => expect(screen.getByRole('textbox', { name: 'Name' })).toHaveFocus());
    await userEvent.click(screen.getByRole('button', { name: 'Close' }));

    await waitFor(() => expect(opener).toHaveFocus());
  });

  it('leaves focus alone when it was moved on purpose after closing', async () => {
    function Screen() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <button onClick={() => setOpen(true)}>Open</button>
          <input aria-label="Elsewhere" />
          {open && (
            <Dialog
              open
              title="Edit access"
              onClose={() => {
                setOpen(false);
                screen.getByRole('textbox', { name: 'Elsewhere' }).focus();
              }}
            >
              <input aria-label="Name" />
            </Dialog>
          )}
        </>
      );
    }
    render(<Screen />);

    await userEvent.click(screen.getByRole('button', { name: 'Open' }));
    await waitFor(() => expect(screen.getByRole('textbox', { name: 'Name' })).toHaveFocus());
    await userEvent.keyboard('{Escape}');

    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(screen.getByRole('textbox', { name: 'Elsewhere' })).toHaveFocus();
  });
});
