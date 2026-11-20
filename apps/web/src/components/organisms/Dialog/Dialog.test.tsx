import { render, screen } from '../../../test/render';
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
});
