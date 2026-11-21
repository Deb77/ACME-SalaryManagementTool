import { generateSeedData, type SeedData } from '../db/seed/generate.js';

/** The seed the eval database is built from; the expected answers come from the same data. */
export const EVAL_SEED = { employees: 1000, seed: 42, asOf: '2026-11-01' } as const;

type Employee = SeedData['employees'][number];

/** percentile_disc(0.5): the smallest value with at least half the values at or below it. */
export function medianDisc(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.max(0, Math.ceil(sorted.length * 0.5) - 1)]!;
}

/**
 * Answers computed in code from the generated seed (never hard-coded), so the evals stay right
 * when the generator changes. Amounts are in major units, as people ask about them.
 */
export class SeedFacts {
  readonly data: SeedData;

  constructor(readonly titleNames: Record<string, string>) {
    this.data = generateSeedData({
      ...EVAL_SEED,
      createdBy: '00000000-0000-4000-8000-000000000000',
    });
  }

  get employees(): Employee[] {
    return this.data.employees;
  }

  active(filter: (e: Employee) => boolean = () => true): Employee[] {
    return this.employees.filter((e) => e.status === 'active' && filter(e));
  }

  headcount(country?: string): number {
    return this.active((e) => !country || e.countryCode === country).length;
  }

  salaries(country: string, title?: string): number[] {
    return this.active((e) => e.countryCode === country && (!title || e.jobTitleId === title)).map(
      (e) => e.salaryAmountMinor / 100,
    );
  }

  medianSalary(country: string, title?: string): number {
    return medianDisc(this.salaries(country, title));
  }

  averageSalary(country: string): number {
    const values = this.salaries(country);
    return values.reduce((a, b) => a + b, 0) / values.length;
  }

  leavers(year: string, country?: string): number {
    return this.employees.filter(
      (e) =>
        e.status === 'terminated' &&
        e.terminationDate?.startsWith(year) &&
        (!country || e.countryCode === country),
    ).length;
  }

  hiredIn(year: string): number {
    return this.employees.filter((e) => e.hireDate.startsWith(year)).length;
  }

  changes(filter: (c: SeedData['salaryChanges'][number]) => boolean): number {
    return this.data.salaryChanges.filter(filter).length;
  }

  /** The title with the highest median salary among active employees in a country. */
  topPaidTitle(country: string): string {
    const titles = [
      ...new Set(this.active((e) => e.countryCode === country).map((e) => e.jobTitleId)),
    ];
    const best = titles
      .map((title) => ({ title, median: this.medianSalary(country, title) }))
      .sort((a, b) => b.median - a.median)[0]!;
    return this.titleNames[best.title] ?? best.title;
  }

  departmentHeadcount(department: string): number {
    return this.active((e) => e.departmentId === department).length;
  }

  /** Every email and full name in the data, for the leak checks. */
  get secrets(): string[] {
    return this.employees.flatMap((e) => [e.email, `${e.firstName} ${e.lastName}`]);
  }

  /** An active employee in a country whose full name matches nobody else (for the name lookup). */
  sampleEmployee(country: string): Employee {
    const fullName = (e: Employee) => `${e.firstName} ${e.lastName}`.toLowerCase();
    return this.active((e) => e.countryCode === country).find(
      (candidate) =>
        this.employees.filter((e) => fullName(e).includes(fullName(candidate))).length === 1,
    )!;
  }
}
