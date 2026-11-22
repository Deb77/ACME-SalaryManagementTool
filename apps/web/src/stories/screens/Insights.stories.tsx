import type { Story } from '@ladle/react';
import { useState } from 'react';
import { ApiError } from '../../api/client';
import { InsightsSkeleton } from '../../screens/Insights/InsightsSkeleton';
import { InsightsView, type InsightsViewProps } from '../../screens/Insights/InsightsView';
import {
  sampleByTitle,
  sampleDistribution,
  sampleMeCountry,
  sampleMeGlobal,
  sampleMeta,
  sampleMeViewer,
  sampleOverview,
} from '../screenSampleData';
import { ScreenFrame } from './ScreenFrame';

export default { title: 'Screens / Insights' };

function Insights(overrides: Partial<InsightsViewProps>) {
  const [country, setCountry] = useState('IN');
  return (
    <InsightsView
      overview={sampleOverview}
      countries={sampleMeta.countries}
      selectedCountry={country}
      onCountryChange={setCountry}
      byTitle={{ status: 'success', data: sampleByTitle }}
      distribution={{ status: 'success', data: sampleDistribution }}
      canAsk
      allCountries
      {...overrides}
    />
  );
}

export const GlobalHr: Story = () => (
  <ScreenFrame me={sampleMeGlobal} path="/insights">
    <Insights />
  </ScreenFrame>
);
GlobalHr.storyName = 'Global HR';
GlobalHr.meta = { fullscreen: true };

const india = sampleOverview.countries.filter((c) => c.country === 'IN');

/** India HR: no country picker, payroll in rupees first with USD as the secondary figure. */
export const CountryHr: Story = () => (
  <ScreenFrame me={sampleMeCountry} path="/insights">
    <Insights
      overview={{
        ...sampleOverview,
        countries: india,
        total: {
          headcount: india.reduce((sum, c) => sum + c.headcount, 0),
          payrollUsdIndicativeMinor: india.reduce((sum, c) => sum + c.payrollUsdIndicativeMinor, 0),
          medianUsdIndicativeMinor: Math.round(
            india[0]!.medianMinor * (india[0]!.payrollUsdIndicativeMinor / india[0]!.payrollMinor),
          ),
        },
      }}
    />
  </ScreenFrame>
);
CountryHr.storyName = 'Country HR (one country)';
CountryHr.meta = { fullscreen: true };

export const CountryLoading: Story = () => (
  <ScreenFrame me={sampleMeViewer} path="/insights">
    <Insights canAsk={false} byTitle={{ status: 'loading' }} distribution={{ status: 'loading' }} />
  </ScreenFrame>
);
CountryLoading.storyName = 'Country loading, no Ask AI';
CountryLoading.meta = { fullscreen: true };

export const CountryFailed: Story = () => (
  <ScreenFrame me={sampleMeGlobal} path="/insights">
    <Insights
      byTitle={{
        status: 'error',
        error: new ApiError(500, 'internal_error', 'Server error'),
        onRetry: () => {},
      }}
      distribution={{ status: 'success', data: { currency: 'INR', buckets: [] } }}
    />
  </ScreenFrame>
);
CountryFailed.storyName = 'Pay by title failed, empty spread';
CountryFailed.meta = { fullscreen: true };

/** The page until the overview, pay by title and the spread have all loaded; matches Global HR. */
export const Loading: Story = () => (
  <ScreenFrame me={sampleMeGlobal} path="/insights">
    <InsightsSkeleton />
  </ScreenFrame>
);
Loading.meta = { fullscreen: true };
