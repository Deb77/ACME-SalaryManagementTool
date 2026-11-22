import { useState } from 'react';
import { describeError } from '../../api/client';
import {
  getInsightsByTitle,
  getInsightsOverview,
  getSalaryDistribution,
} from '../../api/endpoints';
import { useResource } from '../../api/useResource';
import { ErrorState } from '../../components';
import { useSession } from '../../session/SessionContext';
import { InsightsView, type AsyncData } from './InsightsView';
import { InsightsSkeleton } from './InsightsSkeleton';

const asAsync = <T,>(resource: {
  status: string;
  data?: T;
  error?: unknown;
  reload: () => void;
}): AsyncData<T> => ({
  status:
    resource.status === 'success' ? 'success' : resource.status === 'error' ? 'error' : 'loading',
  data: resource.data,
  error: resource.error,
  onRetry: resource.reload,
});

/** Container: the overview, then pay by title and the spread for the chosen country. */
export function InsightsScreen() {
  const { me, meta, can } = useSession();
  const overview = useResource('insights-overview', (signal) => getInsightsOverview({ signal }));
  const [chosen, setChosen] = useState<string>();
  const [shown, setShown] = useState(false);
  const available = overview.data?.countries.map((c) => c.country) ?? [];
  const country =
    chosen && available.includes(chosen)
      ? chosen
      : (available.find((code) => me.countries.includes(code)) ?? available[0]);
  const byTitle = useResource(country ? `by-title-${country}` : null, (signal) =>
    getInsightsByTitle(country ?? '', { signal }),
  );
  const distribution = useResource(country ? `distribution-${country}` : null, (signal) =>
    getSalaryDistribution(country ?? '', { signal }),
  );

  if (overview.status === 'error') {
    return (
      <ErrorState
        title="Insights could not load"
        description={describeError(overview.error)}
        onRetry={overview.reload}
      />
    );
  }
  // The page appears once with all three sections filled: pay by title and the spread wait for
  // the overview (they need its countries), and swapping each in as it landed made the page
  // flicker. Later country changes show each section's own placeholder instead.
  const settled = (status: string) => status === 'success' || status === 'error';
  const allLoaded =
    overview.data !== undefined &&
    (country === undefined || (settled(byTitle.status) && settled(distribution.status)));
  if (allLoaded && !shown) setShown(true);
  if (!overview.data || (!shown && !allLoaded)) return <InsightsSkeleton />;

  return (
    <InsightsView
      overview={overview.data}
      countries={meta.countries}
      selectedCountry={country ?? ''}
      onCountryChange={setChosen}
      byTitle={asAsync(byTitle)}
      distribution={asAsync(distribution)}
      canAsk={can('ai:ask')}
      allCountries={me.role.countryScope === 'all'}
    />
  );
}
