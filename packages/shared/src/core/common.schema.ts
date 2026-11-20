import { z } from 'zod';

/** ISO 3166-1 alpha-2, e.g. `IN`, `GB`. The list of supported countries lives in the catalogue. */
export const countryCodeSchema = z
  .string()
  .regex(/^[A-Z]{2}$/, 'Expected a two-letter country code such as "IN"');

/** Catalogue ids are stable slugs, e.g. `data-analyst`, `engineering`. */
export const catalogueIdSchema = z
  .string()
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'Expected a catalogue id such as "data-analyst"');

/** Calendar date without a time zone (`YYYY-MM-DD`): hire, termination and effective dates. */
export const isoDateSchema = z.iso.date();

/** Instant in UTC (`2026-11-18T09:30:00.000Z`): createdAt, occurredAt. */
export const timestampSchema = z.iso.datetime();

/** Optimistic-concurrency token; incremented on every write to the record. */
export const versionSchema = z.int().min(1);

export const catalogueRefSchema = z.object({ id: catalogueIdSchema, name: z.string() });
export type CatalogueRef = z.infer<typeof catalogueRefSchema>;

export const userRefSchema = z.object({ id: z.uuid(), name: z.string() });
export type UserRef = z.infer<typeof userRefSchema>;
