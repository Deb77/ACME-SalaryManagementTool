import { describe, expect, it } from 'vitest';
import { metaSchema } from './meta.schema.js';

describe('metaSchema', () => {
  it('accepts the catalogue with countries, reasons and the FX table', () => {
    const meta = {
      countries: [{ code: 'IN', name: 'India', currency: 'INR', minorUnits: 2 }],
      departments: [{ id: 'engineering', name: 'Engineering' }],
      jobTitles: [{ id: 'data-analyst', name: 'Data Analyst' }],
      salaryChangeReasons: ['annual_review', 'promotion'],
      terminationReasons: ['resignation'],
      fx: { ratesAsOf: '2026-11-01', rates: { INR: 0.012 } },
    };
    expect(metaSchema.parse(meta)).toEqual(meta);
  });

  it('rejects a system-only salary reason in the pickable list', () => {
    const result = metaSchema.shape.salaryChangeReasons.safeParse(['hire']);
    expect(result.success).toBe(false);
  });
});
