import { act } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '../../../test/render';
import { LoadingState } from './LoadingState';

describe('LoadingState', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('announces what is loading as a polite, busy status', () => {
    render(<LoadingState label="Loading salary history…" />);

    const status = screen.getByRole('status');
    expect(status).toHaveTextContent('Loading salary history…');
    expect(status).toHaveAttribute('aria-live', 'polite');
    expect(status).toHaveAttribute('aria-busy', 'true');
  });

  it('reserves its space at once but draws the skeleton only after the delay', () => {
    const { container } = render(<LoadingState shape="table" rows={3} delayMs={150} />);

    expect(screen.getByRole('status')).toHaveStyle({ minHeight: '320px' });
    expect(container.querySelectorAll('[data-skeleton]')).toHaveLength(0);

    act(() => vi.advanceTimersByTime(150));

    expect(container.querySelectorAll('[data-skeleton]').length).toBeGreaterThan(0);
  });

  it('draws one line per row for text', () => {
    const { container } = render(<LoadingState shape="lines" rows={4} delayMs={0} />);

    expect(container.querySelectorAll('[data-skeleton]')).toHaveLength(4);
  });
});
