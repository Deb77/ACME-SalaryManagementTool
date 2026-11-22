import { sql, type SQL } from 'drizzle-orm';
import type {
  InsightsByTitle,
  InsightsOverview,
  SalaryDistribution,
  TitleComparison,
} from '@acme/shared';
import { assertCountryInScope, type Actor } from '../../auth/actor.js';
import type { ScopedDb } from '../../db/scope.js';
import { notFound } from '../../lib/errors.js';
import type { Catalogue, CatalogueService } from '../meta/catalogue.service.js';

interface StatsRow extends Record<string, unknown> {
  key: string;
  currency: string;
  headcount: string | number;
  min_minor: string | number;
  median_minor: string | number;
  avg_minor: string | number;
  max_minor: string | number;
  payroll_minor: string | number;
}

/**
 * Pay statistics over active employees, one aggregate query each, in one currency per row.
 * `percentile_disc` keeps medians in whole minor units; averages round half-up. RLS limits the
 * rows to the actor's countries, so the same query serves Global and Country HR.
 */
const statsColumns = sql`
  count(*) as headcount,
  min(salary_amount_minor) as min_minor,
  percentile_disc(0.5) within group (order by salary_amount_minor) as median_minor,
  round(avg(salary_amount_minor)) as avg_minor,
  max(salary_amount_minor) as max_minor,
  sum(salary_amount_minor) as payroll_minor`;

const stats = (row: StatsRow) => ({
  headcount: Number(row.headcount),
  minMinor: Number(row.min_minor),
  medianMinor: Number(row.median_minor),
  avgMinor: Number(row.avg_minor),
  maxMinor: Number(row.max_minor),
});

export class InsightsService {
  constructor(
    private readonly scoped: ScopedDb,
    private readonly catalogue: CatalogueService,
  ) {}

  async overview(actor: Actor): Promise<InsightsOverview> {
    const catalogue = await this.catalogue.get();
    const rows = await this.query(
      actor,
      sql`select country_code as key, salary_currency as currency, ${statsColumns}
            from employees where status = 'active'
           group by country_code, salary_currency
           order by count(*) desc, country_code`,
    );
    const countries = rows.map((row) => {
      const payrollMinor = Number(row.payroll_minor);
      return {
        country: row.key,
        currency: row.currency,
        ...stats(row),
        payrollMinor,
        payrollUsdIndicativeMinor: catalogue.toUsdMinor(payrollMinor, row.currency),
      };
    });
    return {
      countries,
      total: {
        headcount: countries.reduce((sum, c) => sum + c.headcount, 0),
        payrollUsdIndicativeMinor: countries.reduce(
          (sum, c) => sum + c.payrollUsdIndicativeMinor,
          0,
        ),
        medianUsdIndicativeMinor: await this.medianUsd(actor, catalogue),
      },
      fx: { indicative: true, ratesAsOf: catalogue.ratesAsOf, base: 'USD' },
    };
  }

  /**
   * One median over every active employee in scope. Currencies cannot be compared as they are,
   * so each salary is converted to USD at the catalogue's fixed rates before ranking.
   */
  private async medianUsd(actor: Actor, catalogue: Catalogue): Promise<number> {
    const rates = catalogue.usdMinorPerMinorUnit();
    if (rates.length === 0) return 0;
    const values = sql.join(
      rates.map(([currency, factor]) => sql`(${currency}, ${String(factor)}::numeric)`),
      sql`, `,
    );
    const rows = await this.query(
      actor,
      sql`select percentile_disc(0.5) within group (order by e.salary_amount_minor * r.factor)
                 as median_minor
            from employees e
            join (values ${values}) as r(currency, factor) on r.currency = e.salary_currency
           where e.status = 'active'`,
    );
    return Math.round(Number(rows[0]?.median_minor ?? 0));
  }

  async byTitle(actor: Actor, country: string, department?: string): Promise<InsightsByTitle> {
    const catalogue = await this.catalogue.get();
    catalogue.assertKnown('country', country);
    assertCountryInScope(actor, country);
    const rows = await this.query(
      actor,
      sql`select job_title_id as key, salary_currency as currency, ${statsColumns}
            from employees
           where status = 'active' and country_code = ${country}
             ${department ? sql`and department_id = ${department}` : sql``}
           group by job_title_id, salary_currency
           order by percentile_disc(0.5) within group (order by salary_amount_minor) desc`,
    );
    return {
      country,
      currency: catalogue.currencyOf(country),
      rows: rows.map((row) => ({
        jobTitle: catalogue.jobTitle(row.key),
        ...stats(row),
        payrollMinor: Number(row.payroll_minor),
      })),
    };
  }

  async titleComparison(actor: Actor, jobTitleId: string): Promise<TitleComparison> {
    const catalogue = await this.catalogue.get();
    if (!catalogue.hasJobTitle(jobTitleId)) throw notFound('Job title not found');
    const rows = await this.query(
      actor,
      sql`select country_code as key, salary_currency as currency, ${statsColumns}
            from employees
           where status = 'active' and job_title_id = ${jobTitleId}
           group by country_code, salary_currency
           order by country_code`,
    );
    return {
      jobTitle: catalogue.jobTitle(jobTitleId),
      rows: rows
        .map((row) => {
          const s = stats(row);
          return {
            country: row.key,
            currency: row.currency,
            ...s,
            medianUsdIndicativeMinor: catalogue.toUsdMinor(s.medianMinor, row.currency),
          };
        })
        .sort((a, b) => b.medianUsdIndicativeMinor - a.medianUsdIndicativeMinor),
    };
  }

  /** Equal-width buckets between min and max, computed in one pass with `width_bucket`. */
  async distribution(
    actor: Actor,
    country: string,
    jobTitle: string | undefined,
    buckets: number,
  ): Promise<SalaryDistribution> {
    const catalogue = await this.catalogue.get();
    catalogue.assertKnown('country', country);
    if (jobTitle) catalogue.assertKnown('jobTitleId', jobTitle);
    assertCountryInScope(actor, country);
    const currency = catalogue.currencyOf(country);
    const filter = sql`status = 'active' and country_code = ${country}
      ${jobTitle ? sql`and job_title_id = ${jobTitle}` : sql``}`;
    const rows = await this.scoped.run(actor, async (tx) => {
      const { rows } = await tx.execute<{
        lo: string;
        hi: string;
        bucket: number | null;
        count: string;
      }>(sql`
        with bounds as (
          select min(salary_amount_minor) as lo, max(salary_amount_minor) as hi
            from employees where ${filter}
        )
        select b.lo, b.hi,
               width_bucket(e.salary_amount_minor, b.lo, b.hi + 1, ${buckets}) as bucket,
               count(*) as count
          from employees e cross join bounds b
         where ${filter}
         group by b.lo, b.hi, bucket
         order by bucket`);
      return rows;
    });
    const first = rows[0];
    if (!first) return { currency, buckets: [] };
    const lo = Number(first.lo);
    const hi = Number(first.hi) + 1;
    const width = (hi - lo) / buckets;
    const counts = new Map(rows.map((r) => [Number(r.bucket), Number(r.count)]));
    return {
      currency,
      buckets: Array.from({ length: buckets }, (_, i) => ({
        fromMinor: Math.round(lo + i * width),
        toMinor: Math.round(lo + (i + 1) * width),
        count: counts.get(i + 1) ?? 0,
      })),
    };
  }

  private query(actor: Actor, statement: SQL): Promise<StatsRow[]> {
    return this.scoped.run(actor, async (tx) => (await tx.execute<StatsRow>(statement)).rows);
  }
}
