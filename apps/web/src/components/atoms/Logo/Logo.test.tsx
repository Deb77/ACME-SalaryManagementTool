import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Logo } from './Logo';

describe('Logo', () => {
  it('draws at the given size, hidden from assistive technology', () => {
    const { getByTestId } = render(<Logo size={48} />);
    const svg = getByTestId('logo');
    expect(svg).toHaveAttribute('width', '48');
    expect(svg).toHaveAttribute('aria-hidden', 'true');
  });

  it('gives each copy its own gradient, so two logos on a page both paint', () => {
    const { container } = render(
      <>
        <Logo />
        <Logo />
      </>,
    );
    const ids = [...container.querySelectorAll('linearGradient')].map((g) => g.id);
    expect(new Set(ids).size).toBe(2);
  });
});
