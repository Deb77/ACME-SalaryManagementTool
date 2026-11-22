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
  allCountries: true,
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
            total: { headcount: 0, payrollUsdIndicativeMinor: 0, medianUsdIndicativeMinor: 0 },
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
        medianUsdIndicativeMinor: 2_530_000,
      },
    };
    render(<InsightsView {...props({ overview })} />);

    expect(screen.queryByRole('radiogroup', { name: 'Country' })).not.toBeInTheDocument();
    const tile = screen.getByText('Annual payroll').parentElement!.parentElement!;
    expect(tile).toHaveTextContent('₹');
    expect(tile).toHaveTextContent(/≈ \$[\d.]+[KMB]? indicative/);
    // Their whole scope is one country, so its median leads in rupees.
    const median = screen.getByText('Median salary').parentElement!.parentElement!;
    expect(median).toHaveTextContent('₹');
    expect(screen.queryByText('Payroll by country')).not.toBeInTheDocument();
  });

  it('keeps the country picker and USD totals across several countries', () => {
    render(<InsightsView {...props()} />);

    expect(screen.getByRole('radiogroup', { name: 'Country' })).toBeInTheDocument();
  });

  it('shows one median for everyone in scope, whichever country is picked', () => {
    const { rerender } = render(<InsightsView {...props()} />);
    const median = () => screen.getByText('Median salary').parentElement!.parentElement!;
    expect(median()).toHaveTextContent('$98.5K');
    expect(median()).toHaveTextContent('across 8 countries');

    rerender(<InsightsView {...props({ selectedCountry: 'GB' })} />);
    expect(median()).toHaveTextContent('$98.5K');
  });

  it('puts payroll by country with the figures for all countries, above the country picker', () => {
    render(<InsightsView {...props()} />);

    const [payroll] = screen.getAllByText('Payroll by country');
    const picker = screen.getByRole('radiogroup', { name: 'Country' });
    expect(
      payroll!.compareDocumentPosition(picker) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(screen.queryByText(/Showing 1–8 of 8/)).not.toBeInTheDocument();
  });
});
