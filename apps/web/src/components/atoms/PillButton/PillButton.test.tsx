import { render, screen } from '../../../test/render';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { PillButton } from './PillButton';

describe('PillButton', () => {
  it('calls onClick when pressed', async () => {
    const onClick = vi.fn();
    render(<PillButton onClick={onClick}>Export CSV</PillButton>);

    await userEvent.click(screen.getByRole('button', { name: 'Export CSV' }));

    expect(onClick).toHaveBeenCalledOnce();
  });

  it('does not submit forms unless asked to', () => {
    render(<PillButton>Cancel</PillButton>);

    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveAttribute('type', 'button');
  });

  it('cannot be pressed while loading', async () => {
    const onClick = vi.fn();
    render(
      <PillButton tone="primary" loading onClick={onClick}>
        Save change
      </PillButton>,
    );

    await userEvent.click(screen.getByRole('button', { name: /Save change/ }));

    expect(onClick).not.toHaveBeenCalled();
  });
});
