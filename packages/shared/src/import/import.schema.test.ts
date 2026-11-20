import { describe, expect, it } from 'vitest';
import { importMappingRequestSchema, importRowSchema } from './import.schema.js';

describe('importMappingRequestSchema', () => {
  it('accepts a partial mapping with defaults', () => {
    const body = {
      mapping: { employeeCode: 'Emp ID', salaryAmount: 'Annual CTC' },
      defaults: { country: 'IN', salaryEffectiveDate: '2026-11-01' },
    };
    expect(importMappingRequestSchema.parse(body)).toEqual(body);
  });

  it('rejects a field that cannot be imported', () => {
    const result = importMappingRequestSchema.safeParse({ mapping: { level: 'Grade' } });
    expect(result.success).toBe(false);
  });
});

describe('importRowSchema', () => {
  it('accepts a row error that explains the problem per column', () => {
    const row = {
      rowNumber: 640,
      outcome: 'error',
      employeeCode: 'ACM-000377',
      changes: {},
      errors: [{ column: 'Country', message: 'US is outside your countries.' }],
    };
    expect(importRowSchema.parse(row)).toEqual(row);
  });
});
