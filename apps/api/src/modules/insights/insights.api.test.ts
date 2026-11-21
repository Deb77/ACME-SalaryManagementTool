import { describe, expect, it } from 'vitest';
import {
  employeeSchema,
  insightsByTitleSchema,
  insightsOverviewSchema,
  pageSchema,
  salaryDistributionSchema,
  titleComparisonSchema,
} from '@acme/shared';
import { useTestApi } from '../../test/api.js';

/** The HTTP API for insights, against its own seeded Postgres with RLS on. */
const api = useTestApi();

describe('insights', () => {
  it('overview counts the same people as the list', async () => {
    const overview = insightsOverviewSchema.parse(
      (await api.globalHr.get('/api/insights/overview')).body,
    );
    const list = pageSchema(employeeSchema).parse(
      (await api.globalHr.get('/api/employees?pageSize=1')).body,
    );
    expect(overview.total.headcount).toBe(list.total);
    expect(overview.fx.indicative).toBe(true);
    for (const c of overview.countries) {
      expect(c.minMinor).toBeLessThanOrEqual(c.medianMinor);
      expect(c.medianMinor).toBeLessThanOrEqual(c.maxMinor);
    }
  });

  it('gives one median across every country in scope, in indicative USD', async () => {
    const usdPerMinor = (c: { payrollMinor: number; payrollUsdIndicativeMinor: number }) =>
      c.payrollUsdIndicativeMinor / c.payrollMinor;
    const global = insightsOverviewSchema.parse(
      (await api.globalHr.get('/api/insights/overview')).body,
    );
    const countryMedians = global.countries.map((c) => c.medianMinor * usdPerMinor(c));
    // Half of each country earns at most its median, so the overall median sits between them.
    expect(global.total.medianUsdIndicativeMinor).toBeGreaterThanOrEqual(
      Math.min(...countryMedians) - 1,
    );
    expect(global.total.medianUsdIndicativeMinor).toBeLessThanOrEqual(
      Math.max(...countryMedians) + 1,
    );

    const india = insightsOverviewSchema.parse(
      (await api.indiaHr.get('/api/insights/overview')).body,
    );
    const [only] = india.countries;
    expect(india.total.medianUsdIndicativeMinor).toBeCloseTo(
      only!.medianMinor * usdPerMinor(only!),
      -2,
    );
  });

  it('limits Country HR to their countries', async () => {
    const overview = insightsOverviewSchema.parse(
      (await api.indiaHr.get('/api/insights/overview')).body,
    );
    expect(overview.countries.map((c) => c.country)).toEqual(['IN']);
    expect((await api.indiaHr.get('/api/insights/by-title?country=GB')).status).toBe(403);
  });

  it('serves by-title, title comparison and a distribution that adds up', async () => {
    const byTitle = insightsByTitleSchema.parse(
      (await api.globalHr.get('/api/insights/by-title?country=IN')).body,
    );
    const headcount = byTitle.rows.reduce((sum, r) => sum + r.headcount, 0);
    const dist = salaryDistributionSchema.parse(
      (await api.globalHr.get('/api/insights/distribution?country=IN&buckets=9')).body,
    );
    expect(dist.buckets).toHaveLength(9);
    expect(dist.buckets.reduce((sum, b) => sum + b.count, 0)).toBe(headcount);
    titleComparisonSchema.parse((await api.globalHr.get('/api/insights/titles/data-analyst')).body);
    expect((await api.globalHr.get('/api/insights/titles/nope')).status).toBe(404);
  });
});
