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
  if (!overview.data) return <InsightsSkeleton />;

  return (
    <InsightsView
      overview={overview.data}
      countries={meta.countries}
      selectedCountry={country ?? ''}
      onCountryChange={setChosen}
      byTitle={asAsync(byTitle)}
      distribution={asAsync(distribution)}
      canAsk={can('ai:ask')}
    />
  );
}
