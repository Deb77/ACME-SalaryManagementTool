import { render, screen } from '../../../test/render';
import { describe, expect, it } from 'vitest';
import { StatTile } from './StatTile';

describe('StatTile', () => {
  it('is a region named by its label showing the value and note', () => {
    render(<StatTile label="Active employees" value="9,500" delta="+412" note="hired in 2026" />);

    const tile = screen.getByRole('region', { name: 'Active employees' });
    expect(tile).toHaveTextContent('9,500');
    expect(tile).toHaveTextContent('+412 hired in 2026');
  });

  it('hides the decorative trend bars from assistive technology', () => {
    render(<StatTile label="Countries" value="8" trend={[8, 7, 8]} />);

    expect(screen.getByTestId('stat-trend')).toHaveAttribute('aria-hidden', 'true');
  });

  it('scales trend bars relative to the largest point', () => {
    render(<StatTile label="Changes" value="318" trend={[10, 20, 40]} />);

    const bars = Array.from(screen.getByTestId('stat-trend').children) as HTMLElement[];
    expect(bars.map((bar) => bar.style.height)).toEqual(['12px', '24px', '48px']);
  });
});
