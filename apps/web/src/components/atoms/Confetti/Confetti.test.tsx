import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '../../../test/render';
import { Confetti } from './Confetti';

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('Confetti', () => {
  it('falls for a moment, hidden from assistive technology, then removes itself', () => {
    vi.useFakeTimers();
    render(<Confetti pieces={12} durationMs={1000} />);

    const burst = screen.getByTestId('confetti');
    expect(burst).toHaveAttribute('aria-hidden', 'true');
    expect(burst.children).toHaveLength(12);
    act(() => vi.advanceTimersByTime(1000));
    expect(screen.queryByTestId('confetti')).not.toBeInTheDocument();
  });

  it('shows nothing to people who ask for reduced motion', () => {
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: query.includes('reduce'),
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    }));
    render(<Confetti />);

    expect(screen.queryByTestId('confetti')).not.toBeInTheDocument();
  });
});
