import { render, screen } from '../../../test/render';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ErrorBoundary } from './ErrorBoundary';

let shouldThrow = true;
function Flaky() {
  if (shouldThrow) throw new Error('boom');
  return <p>Recovered</p>;
}

describe('ErrorBoundary', () => {
  beforeEach(() => {
    shouldThrow = true;
    // React logs caught render errors; keep the test output clean.
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => vi.restoreAllMocks());

  it('shows a recoverable error instead of crashing', async () => {
    const onError = vi.fn();
    render(
      <ErrorBoundary onError={onError}>
        <Flaky />
      </ErrorBoundary>,
    );

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'boom' }),
      expect.anything(),
    );

    shouldThrow = false;
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));

    expect(screen.getByText('Recovered')).toBeInTheDocument();
  });

  it('renders children when nothing fails', () => {
    function Fine() {
      const [text] = useState('All good');
      return <p>{text}</p>;
    }
    render(
      <ErrorBoundary>
        <Fine />
      </ErrorBoundary>,
    );

    expect(screen.getByText('All good')).toBeInTheDocument();
  });
});
