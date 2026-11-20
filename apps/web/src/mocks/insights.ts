/**
 * Insights for the mock API. The fixture figures (sampleOverview, sampleByTitle for India,
 * sampleDistribution) are richer than the ~50-person in-memory directory, so they are served
 * as-is for India and scaled to the other countries by the overview's median ratio. Country
 * HR only sees their countries.
 */
import type {
  InsightsByTitle,
  InsightsOverview,
  Me,
  SalaryDistribution,
  TitleComparison,
} from '@acme/shared';
import {
  sampleByTitle,
  sampleDistribution,
  sampleMeta,
  sampleOverview,
} from '../stories/screenSampleData';
import { forbidden, notFound } from './store';

const overviewFor = (country: string) =>
  sampleOverview.countries.find((row) => row.country === country);

/** INR minor units → the country's minor units, keeping the overview's relative pay levels. */
function scaleFrom(country: string) {
  const india = overviewFor('IN')!;
  const target = overviewFor(country) ?? india;
  const factor = target.medianMinor / india.medianMinor;
  return (minor: number) => Math.round((minor * factor) / 100) * 100;
}

function assertInScope(me: Me, country: string) {
  if (!me.countries.includes(country)) throw forbidden('insights:read');
  if (!sampleMeta.countries.some((c) => c.code === country)) throw notFound('country');
}

export function overview(me: Me): InsightsOverview {
  const countries = sampleOverview.countries.filter((row) => me.countries.includes(row.country));
  return {
    countries,
    total: {
      headcount: countries.reduce((sum, row) => sum + row.headcount, 0),
      payrollUsdIndicativeMinor: countries.reduce(
        (sum, row) => sum + row.payrollUsdIndicativeMinor,
        0,
      ),
    },
    fx: sampleOverview.fx,
  };
}

export function byTitle(me: Me, country: string): InsightsByTitle {
  assertInScope(me, country);
  const scale = scaleFrom(country);
  const currency = overviewFor(country)?.currency ?? sampleByTitle.currency;
  const share = (overviewFor(country)?.headcount ?? 1) / (overviewFor('IN')?.headcount ?? 1);
  return {
    country,
    currency,
    rows: sampleByTitle.rows.map((row) => {
      const headcount = Math.max(1, Math.round(row.headcount * share));
      const medianMinor = scale(row.medianMinor);
      return {
        jobTitle: row.jobTitle,
        headcount,
        minMinor: scale(row.minMinor),
        medianMinor,
        avgMinor: scale(row.avgMinor),
        maxMinor: scale(row.maxMinor),
        payrollMinor: medianMinor * headcount,
      };
    }),
  };
}

export function titleComparison(me: Me, jobTitleId: string): TitleComparison {
  const jobTitle = sampleMeta.jobTitles.find((title) => title.id === jobTitleId);
  const base = sampleByTitle.rows.find((row) => row.jobTitle.id === jobTitleId);
  if (!jobTitle || !base) throw notFound('job title');
  return {
    jobTitle,
    rows: me.countries
      .filter((country) => overviewFor(country))
      .map((country) => {
        const info = overviewFor(country)!;
        const scale = scaleFrom(country);
        const medianMinor = scale(base.medianMinor);
        const usdRate = sampleMeta.fx.rates[info.currency] ?? 1;
        return {
          country,
          currency: info.currency,
          headcount: Math.max(
            1,
            Math.round((base.headcount * info.headcount) / (overviewFor('IN')?.headcount ?? 1)),
          ),
          minMinor: scale(base.minMinor),
          medianMinor,
          avgMinor: scale(base.avgMinor),
          maxMinor: scale(base.maxMinor),
          medianUsdIndicativeMinor: Math.round(medianMinor * usdRate),
        };
      }),
  };
}

export function distribution(me: Me, country: string): SalaryDistribution {
  assertInScope(me, country);
  const scale = scaleFrom(country);
  return {
    currency: overviewFor(country)?.currency ?? sampleDistribution.currency,
    buckets: sampleDistribution.buckets.map((bucket) => ({
      fromMinor: scale(bucket.fromMinor),
      toMinor: scale(bucket.toMinor),
      count: bucket.count,
    })),
  };
}
