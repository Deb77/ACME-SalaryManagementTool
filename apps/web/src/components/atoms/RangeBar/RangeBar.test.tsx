import { render, screen } from '../../../test/render';
import { describe, expect, it } from 'vitest';
import { RangeBar } from './RangeBar';
import { toPercent } from './scale';

describe('RangeBar', () => {
  it('describes the spread to screen readers as a single image', () => {
    render(
      <RangeBar
        label="Data Analyst: ₹7.2L to ₹21L, median ₹12.6L"
        min={7.2}
        median={12.6}
        max={21}
      />,
    );

    expect(
      screen.getByRole('img', { name: 'Data Analyst: ₹7.2L to ₹21L, median ₹12.6L' }),
    ).toBeInTheDocument();
  });

  it('places the median and marker on a shared scale', () => {
    render(
      <RangeBar
        label="spread"
        min={20}
        median={30}
        max={50}
        marker={40}
        scaleMin={0}
        scaleMax={80}
      />,
    );

    expect(screen.getByTestId('range-median').style.left).toBe('37.5%');
    expect(screen.getByTestId('range-marker').style.left).toBe('50%');
  });
});

describe('toPercent', () => {
  it('clamps values outside the scale', () => {
    expect(toPercent(-5, 0, 10)).toBe(0);
    expect(toPercent(15, 0, 10)).toBe(100);
  });

  it('handles an empty scale', () => {
    expect(toPercent(5, 5, 5)).toBe(0);
  });
});
