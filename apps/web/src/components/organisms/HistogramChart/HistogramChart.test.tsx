import { render, screen } from '../../../test/render';
import { describe, expect, it } from 'vitest';
import { HistogramChart } from './HistogramChart';

describe('HistogramChart', () => {
  it('exposes its takeaway as the accessible name', () => {
    render(
      <HistogramChart
        summary="Most India salaries fall between ₹5L and ₹15L"
        bins={[
          { label: '0–5', count: 210 },
          { label: '5–10', count: 640 },
        ]}
        highlightIndex={1}
      />,
    );

    expect(
      screen.getByRole('img', { name: 'Most India salaries fall between ₹5L and ₹15L' }),
    ).toBeInTheDocument();
  });
});
