import { z } from 'zod';
import { catalogueRefSchema, countryCodeSchema, isoDateSchema } from '../core/common.schema.js';
import { currencyCodeSchema } from '../core/money.schema.js';
import { terminationReasons } from '../employee/employee.schema.js';
import { salaryChangeReasons } from '../salary-change/salary-change.schema.js';

export const countryInfoSchema = z.object({
  code: countryCodeSchema,
  name: z.string(),
  currency: currencyCodeSchema,
  minorUnits: z.int().min(0).max(4),
});

export type CountryInfo = z.infer<typeof countryInfoSchema>;

/** `GET /api/meta`: the static catalogue every screen reads (countries, titles, reasons, FX). */
export const metaSchema = z.object({
  countries: z.array(countryInfoSchema),
  departments: z.array(catalogueRefSchema),
  jobTitles: z.array(catalogueRefSchema),
  salaryChangeReasons: z.array(z.enum(salaryChangeReasons)),
  terminationReasons: z.array(z.enum(terminationReasons)),
  fx: z.object({
    ratesAsOf: isoDateSchema,
    /** Units of USD per one unit of the currency; indicative only. */
    rates: z.record(z.string(), z.number().positive()),
  }),
});

export type Meta = z.infer<typeof metaSchema>;
