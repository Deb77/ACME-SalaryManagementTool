import { createHash } from 'node:crypto';
import { asc, desc, eq } from 'drizzle-orm';
import {
  salaryChangeReasons,
  terminationReasons,
  type CatalogueRef,
  type CountryInfo,
  type Meta,
} from '@acme/shared';
import type { Db } from '../../db/database.js';
import { countries, departments, fxRates, jobTitles } from '../../db/schema/index.js';
import { invalid } from '../../lib/errors.js';

/**
 * The static catalogue (countries, departments, job titles, FX). It is written only by
 * migrations, so it is read once and kept in memory; services use it to name things and to
 * validate ids with friendly messages before the foreign keys have to.
 */
export class CatalogueService {
  private loaded: Promise<Catalogue> | undefined;

  constructor(private readonly db: Db) {}

  get(): Promise<Catalogue> {
    this.loaded ??= this.load().catch((error: unknown) => {
      this.loaded = undefined;
      throw error;
    });
    return this.loaded;
  }

  private async load(): Promise<Catalogue> {
    const [countryRows, departmentRows, titleRows, [latest]] = await Promise.all([
      this.db.select().from(countries).orderBy(asc(countries.name)),
      this.db.select().from(departments).orderBy(asc(departments.name)),
      this.db.select().from(jobTitles).orderBy(asc(jobTitles.name)),
      this.db.select({ asOf: fxRates.asOf }).from(fxRates).orderBy(desc(fxRates.asOf)).limit(1),
    ]);
    const rates = latest
      ? await this.db.select().from(fxRates).where(eq(fxRates.asOf, latest.asOf))
      : [];
    return new Catalogue(
      countryRows.map((c) => ({
        code: c.code,
        name: c.name,
        currency: c.currency,
        minorUnits: c.minorUnits,
      })),
      departmentRows,
      titleRows,
      latest?.asOf ?? '1970-01-01',
      Object.fromEntries(rates.map((r) => [r.currency, Number(r.usdPerUnit)])),
    );
  }
}

export class Catalogue {
  readonly countryByCode: ReadonlyMap<string, CountryInfo>;
  private readonly departmentById: ReadonlyMap<string, CatalogueRef>;
  private readonly titleById: ReadonlyMap<string, CatalogueRef>;
  readonly meta: Meta;
  /** Strong ETag of the meta body; the catalogue only changes with a deploy. */
  readonly etag: string;

  constructor(
    readonly countries: readonly CountryInfo[],
    readonly departments: readonly CatalogueRef[],
    readonly jobTitles: readonly CatalogueRef[],
    readonly ratesAsOf: string,
    readonly usdPerUnit: Readonly<Record<string, number>>,
  ) {
    this.countryByCode = new Map(countries.map((c) => [c.code, c]));
    this.departmentById = new Map(departments.map((d) => [d.id, d]));
    this.titleById = new Map(jobTitles.map((t) => [t.id, t]));
    this.meta = {
      countries: [...countries],
      departments: [...departments],
      jobTitles: [...jobTitles],
      salaryChangeReasons: [...salaryChangeReasons],
      terminationReasons: [...terminationReasons],
      fx: { ratesAsOf: ratesAsOf, rates: { ...usdPerUnit } },
    };
    this.etag = `"${createHash('sha256').update(JSON.stringify(this.meta)).digest('base64url').slice(0, 27)}"`;
  }

  department(id: string): CatalogueRef {
    return this.departmentById.get(id) ?? { id, name: id };
  }

  jobTitle(id: string): CatalogueRef {
    return this.titleById.get(id) ?? { id, name: id };
  }

  hasJobTitle(id: string) {
    return this.titleById.has(id);
  }

  /** Throws a 400 naming the field when an id is not in the catalogue. */
  assertKnown(field: 'jobTitleId' | 'departmentId' | 'country', id: string) {
    const known =
      field === 'jobTitleId'
        ? this.titleById.has(id)
        : field === 'departmentId'
          ? this.departmentById.has(id)
          : this.countryByCode.has(id);
    if (!known)
      throw invalid(field, `Unknown ${field === 'country' ? 'country' : 'value'} "${id}"`);
  }

  currencyOf(country: string): string {
    const info = this.countryByCode.get(country);
    if (!info) throw invalid('country', `Unknown country "${country}"`);
    return info.currency;
  }

  minorUnitsOf(currency: string): number {
    return this.countries.find((c) => c.currency === currency)?.minorUnits ?? 2;
  }

  /** Indicative USD cents for an amount in minor units of `currency` (fixed rate table). */
  toUsdMinor(amountMinor: number, currency: string): number {
    const rate = this.usdPerUnit[currency] ?? 0;
    const major = amountMinor / 10 ** this.minorUnitsOf(currency);
    return Math.round(major * rate * 100);
  }
}
