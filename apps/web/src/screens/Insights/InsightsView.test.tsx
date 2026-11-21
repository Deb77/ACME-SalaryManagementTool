import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../api/client';
import {
  sampleByTitle,
  sampleDistribution,
  sampleMeta,
  sampleOverview,
} from '../../stories/screenSampleData';
import { render, screen } from '../../test/render';
import { InsightsView, type InsightsViewProps } from './InsightsView';

const props = (overrides: Partial<InsightsViewProps> = {}): InsightsViewProps => ({
  overview: sampleOverview,
  countries: sampleMeta.countries,
  selectedCountry: 'IN',
  onCountryChange: vi.fn(),
  byTitle: { status: 'success', data: sampleByTitle },
  distribution: { status: 'success', data: sampleDistribution },
  canAsk: true,
  ...overrides,
});

describe('InsightsView', () => {
  it('shows the headline figures, pay by title and the Ask AI link', () => {
    render(<InsightsView {...props()} />);

    expect(screen.getByText('Active employees')).toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Pay by job title' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Ask about this data/ })).toHaveAttribute(
      'href',
      '/ask',
    );
  });

  it('hides Ask AI without ai:ask', () => {
    render(<InsightsView {...props({ canAsk: false })} />);

    expect(screen.queryByRole('link', { name: /Ask about this data/ })).not.toBeInTheDocument();
  });

  it('switches country', async () => {
    const onCountryChange = vi.fn();
    render(<InsightsView {...props({ onCountryChange })} />);

    await userEvent.click(screen.getByRole('radio', { name: 'United Kingdom' }));
    expect(onCountryChange).toHaveBeenCalledWith('GB');
  });

  it('retries a failed section', async () => {
    const onRetry = vi.fn();
    render(
      <InsightsView
        {...props({
          byTitle: { status: 'error', error: new ApiError(500, 'internal_error', 'x'), onRetry },
        })}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: /try again/i }));
    expect(onRetry).toHaveBeenCalled();
  });

  it('explains an empty company', () => {
    render(
      <InsightsView
        {...props({
          overview: {
            ...sampleOverview,
            countries: [],
            total: { headcount: 0, payrollUsdIndicativeMinor: 0 },
          },
        })}
      />,
    );

    expect(screen.getByText('No active employees yet')).toBeInTheDocument();
  });

  it('drops the country picker and leads with local currency for a one-country scope', () => {
    const india = sampleOverview.countries.find((c) => c.country === 'IN')!;
    const overview = {
      ...sampleOverview,
      countries: [india],
      total: {
        headcount: india.headcount,
        payrollUsdIndicativeMinor: india.payrollUsdIndicativeMinor,
      },
    };
    render(<InsightsView {...props({ overview })} />);

    expect(screen.queryByRole('radiogroup', { name: 'Country' })).not.toBeInTheDocument();
    const tile = screen.getByText('Annual payroll').parentElement!.parentElement!;
    expect(tile).toHaveTextContent('₹');
    expect(tile).toHaveTextContent(/≈ \$[\d.]+[KMB]? indicative/);
  });

  it('keeps the country picker and USD totals across several countries', () => {
    render(<InsightsView {...props()} />);

    expect(screen.getByRole('radiogroup', { name: 'Country' })).toBeInTheDocument();
  });
});
