import { render, screen } from '../../../test/render';
import { describe, expect, it } from 'vitest';
import { TrendChart } from './TrendChart';

describe('TrendChart', () => {
  it('exposes its takeaway as the accessible name', () => {
    render(
      <TrendChart
        summary="Monthly payroll rose from $57.9M to $60.9M"
        data={[
          { label: 'Dec', value: 57.9 },
          { label: 'Nov', value: 60.9 },
        ]}
        formatValue={(value) => `$${value}M`}
      />,
    );

    expect(
      screen.getByRole('img', { name: 'Monthly payroll rose from $57.9M to $60.9M' }),
    ).toBeInTheDocument();
  });
});
