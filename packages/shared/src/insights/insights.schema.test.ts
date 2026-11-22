import { describe, expect, it } from 'vitest';
import { insightsOverviewSchema, salaryDistributionSchema } from './insights.schema.js';

describe('insightsOverviewSchema', () => {
  it('accepts per-country stats with an indicative USD total', () => {
    const overview = {
      countries: [
        {
          country: 'IN',
          currency: 'INR',
          headcount: 2104,
          minMinor: 45_000_000,
          medianMinor: 160_000_000,
          avgMinor: 178_250_000,
          maxMinor: 950_000_000,
          payrollMinor: 375_038_000_000,
          payrollUsdIndicativeMinor: 4_501_000_000,
        },
      ],
      total: {
        headcount: 9812,
        payrollUsdIndicativeMinor: 61_230_000_000,
        medianUsdIndicativeMinor: 7_850_000,
      },
      fx: { indicative: true, ratesAsOf: '2026-10-01', base: 'USD' },
    };
    expect(insightsOverviewSchema.parse(overview)).toEqual(overview);
  });

  it('rejects fractional minor units', () => {
    const result = salaryDistributionSchema.safeParse({
      currency: 'INR',
      buckets: [{ fromMinor: 0.5, toMinor: 10, count: 1 }],
    });
    expect(result.success).toBe(false);
  });
});
