import { act } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '../../../test/render';
import { PageSkeleton } from './PageSkeleton';

describe('PageSkeleton', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('announces one loading status for the whole page', () => {
    render(<PageSkeleton label="Loading employee…" variant="detail" />);

    const status = screen.getByRole('status');
    expect(status).toHaveTextContent('Loading employee…');
    expect(status).toHaveAttribute('aria-busy', 'true');
  });

  it('draws the skeleton after the delay, hidden from assistive technology', () => {
    act(() => vi.advanceTimersByTime(1000)); // clear of the previous test's skeleton
    const { container } = render(<PageSkeleton variant="dashboard" delayMs={150} />);

    expect(container.querySelectorAll('[data-skeleton]')).toHaveLength(0);
    act(() => vi.advanceTimersByTime(150));

    expect(container.querySelectorAll('[data-skeleton]').length).toBeGreaterThan(0);
    expect(screen.getAllByRole('status')).toHaveLength(1);
  });

  it('draws a skeleton that takes over from a shown one at once, without a second delay', () => {
    act(() => vi.advanceTimersByTime(1000));
    const { container, rerender } = render(
      <PageSkeleton key="route" variant="dashboard" delayMs={150} />,
    );
    act(() => vi.advanceTimersByTime(150));

    rerender(<PageSkeleton key="screen" variant="dashboard" delayMs={150} />);

    expect(container.querySelectorAll('[data-skeleton]').length).toBeGreaterThan(0);
  });
});
