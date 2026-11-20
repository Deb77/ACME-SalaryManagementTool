import { z } from 'zod';
import { catalogueRefSchema, countryCodeSchema, isoDateSchema } from '../core/common.schema.js';
import { amountMinorSchema, currencyCodeSchema } from '../core/money.schema.js';

/** Pay statistics in one currency. Medians are whole minor units (`percentile_disc`). */
const payStatsShape = {
  headcount: z.int().nonnegative(),
  minMinor: amountMinorSchema,
  medianMinor: amountMinorSchema,
  avgMinor: amountMinorSchema,
  maxMinor: amountMinorSchema,
};

export const countryPayStatsSchema = z.object({
  country: countryCodeSchema,
  currency: currencyCodeSchema,
  ...payStatsShape,
  payrollMinor: amountMinorSchema,
  payrollUsdIndicativeMinor: amountMinorSchema,
});

export type CountryPayStats = z.infer<typeof countryPayStatsSchema>;

/** `GET /api/insights/overview` */
export const insightsOverviewSchema = z.object({
  countries: z.array(countryPayStatsSchema),
  total: z.object({
    headcount: z.int().nonnegative(),
    payrollUsdIndicativeMinor: amountMinorSchema,
  }),
  fx: z.object({ indicative: z.literal(true), ratesAsOf: isoDateSchema, base: z.literal('USD') }),
});

export type InsightsOverview = z.infer<typeof insightsOverviewSchema>;

export const titlePayStatsSchema = z.object({
  jobTitle: catalogueRefSchema,
  ...payStatsShape,
  payrollMinor: amountMinorSchema,
});

export type TitlePayStats = z.infer<typeof titlePayStatsSchema>;

/** `GET /api/insights/by-title?country=IN` */
export const insightsByTitleSchema = z.object({
  country: countryCodeSchema,
  currency: currencyCodeSchema,
  rows: z.array(titlePayStatsSchema),
});

export type InsightsByTitle = z.infer<typeof insightsByTitleSchema>;

/** `GET /api/insights/titles/:jobTitleId`: one title compared across the visible countries. */
export const titleComparisonSchema = z.object({
  jobTitle: catalogueRefSchema,
  rows: z.array(
    z.object({
      country: countryCodeSchema,
      currency: currencyCodeSchema,
      ...payStatsShape,
      medianUsdIndicativeMinor: amountMinorSchema,
    }),
  ),
});

export type TitleComparison = z.infer<typeof titleComparisonSchema>;

/** `GET /api/insights/distribution?country=IN`: equal-width buckets between min and max. */
export const salaryDistributionSchema = z.object({
  currency: currencyCodeSchema,
  buckets: z.array(
    z.object({
      fromMinor: amountMinorSchema,
      toMinor: amountMinorSchema,
      count: z.int().nonnegative(),
    }),
  ),
});

export type SalaryDistribution = z.infer<typeof salaryDistributionSchema>;
