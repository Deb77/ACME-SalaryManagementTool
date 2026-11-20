import { render, screen } from '../../../test/render';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ErrorState } from './ErrorState';

describe('ErrorState', () => {
  it('announces the failure', () => {
    render(<ErrorState title="Could not load employees" />);

    expect(screen.getByRole('alert')).toHaveTextContent('Could not load employees');
  });

  it('offers a retry when one is possible', async () => {
    const onRetry = vi.fn();
    render(<ErrorState onRetry={onRetry} />);

    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));

    expect(onRetry).toHaveBeenCalledOnce();
  });

  it('does not show a retry button without a handler', () => {
    render(<ErrorState />);

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
