import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '../../test/render';
import { TerminateDialog } from './TerminateDialog';

describe('TerminateDialog', () => {
  it('focuses the last working day when it is in the future', async () => {
    const onConfirm = vi.fn();
    render(
      <TerminateDialog
        open
        name="Priya Sharma"
        version={1}
        reasons={['resignation']}
        onCancel={vi.fn()}
        onConfirm={onConfirm}
      />,
    );
    const date = screen.getByLabelText(/Last working day/);
    await userEvent.clear(date);
    await userEvent.type(date, '2999-01-01');
    await userEvent.click(screen.getByRole('button', { name: 'Terminate' }));

    expect(onConfirm).not.toHaveBeenCalled();
    expect(screen.getByText('Choose today or an earlier date')).toBeInTheDocument();
    expect(date).toHaveFocus();
  });
});
