import { render, screen } from '../../../test/render';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ConfirmDialog } from './ConfirmDialog';

function renderConfirm(overrides: Partial<Parameters<typeof ConfirmDialog>[0]> = {}) {
  const props = {
    open: true,
    title: 'Terminate Priya Sharma?',
    description: 'She will be marked as terminated from 30 Nov 2026.',
    confirmLabel: 'Terminate',
    danger: true,
    onConfirm: vi.fn(),
    onCancel: vi.fn(),
    ...overrides,
  };
  render(<ConfirmDialog {...props} />);
  return props;
}

describe('ConfirmDialog', () => {
  it('confirms with the named action', async () => {
    const { onConfirm } = renderConfirm();

    await userEvent.click(screen.getByRole('button', { name: 'Terminate' }));

    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it('cancels without confirming', async () => {
    const { onConfirm, onCancel } = renderConfirm();

    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onCancel).toHaveBeenCalled();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('disables cancelling while the action runs', () => {
    renderConfirm({ loading: true });

    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
  });
});
