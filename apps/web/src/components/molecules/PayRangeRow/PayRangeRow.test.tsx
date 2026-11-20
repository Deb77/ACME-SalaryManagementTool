import { render, screen } from '../../../test/render';
import { describe, expect, it } from 'vitest';
import { PayRangeRow } from './PayRangeRow';

const dataAnalyst = {
  title: 'Data Analyst',
  currency: 'INR',
  minMinor: 720_000_00,
  medianMinor: 1_260_000_00,
  maxMinor: 2_100_000_00,
};

describe('PayRangeRow', () => {
  it('describes the range in money to screen readers', () => {
    render(<PayRangeRow {...dataAnalyst} />);

    expect(
      screen.getByRole('img', { name: 'Data Analyst: ₹7.2L to ₹21L, median ₹12.6L' }),
    ).toBeInTheDocument();
  });

  it('shows the title and the median amount', () => {
    render(<PayRangeRow {...dataAnalyst} />);

    expect(screen.getByText('Data Analyst')).toBeInTheDocument();
    expect(screen.getByText('₹12.6L')).toBeInTheDocument();
  });

  it('marks one salary and names it in the label', () => {
    render(
      <PayRangeRow
        {...dataAnalyst}
        markerMinor={1_500_000_00}
        scaleMinMinor={0}
        scaleMaxMinor={3_000_000_00}
      />,
    );

    expect(screen.getByTestId('range-marker').style.left).toBe('50%');
    expect(screen.getByRole('img').getAttribute('aria-label')).toContain('this employee ₹15L');
  });
});
