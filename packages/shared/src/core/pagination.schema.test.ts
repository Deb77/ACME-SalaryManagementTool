import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { listParamSchema, pageQuerySchema, sortSchema } from './pagination.schema.js';

describe('pageQuerySchema', () => {
  it('defaults to the first page of 25', () => {
    expect(pageQuerySchema.parse({})).toEqual({ page: 1, pageSize: 25 });
  });

  it('reads numbers from query strings', () => {
    expect(pageQuerySchema.parse({ page: '3', pageSize: '50' })).toEqual({ page: 3, pageSize: 50 });
  });

  it('caps the page size at 100 so one request cannot dump the whole table', () => {
    expect(pageQuerySchema.safeParse({ pageSize: '10000' }).success).toBe(false);
  });

  it('rejects page zero', () => {
    expect(pageQuerySchema.safeParse({ page: '0' }).success).toBe(false);
  });
});

describe('sortSchema', () => {
  const sort = sortSchema(['name', 'hireDate'] as const, 'name');

  it('sorts ascending by default', () => {
    expect(sort.parse(undefined)).toEqual({ field: 'name', direction: 'asc' });
  });

  it('sorts descending with a leading minus', () => {
    expect(sort.parse('-hireDate')).toEqual({ field: 'hireDate', direction: 'desc' });
  });

  it('rejects fields that are not allow-listed', () => {
    expect(sort.safeParse('password').success).toBe(false);
    expect(sort.safeParse('-password').success).toBe(false);
  });
});

describe('listParamSchema', () => {
  const countries = listParamSchema(z.string().regex(/^[A-Z]{2}$/));

  it('accepts repeated and comma-separated values', () => {
    expect(countries.parse(['IN', 'GB'])).toEqual(['IN', 'GB']);
    expect(countries.parse('IN, GB')).toEqual(['IN', 'GB']);
  });

  it('treats a missing or empty value as no filter', () => {
    expect(countries.parse(undefined)).toBeUndefined();
    expect(countries.parse('')).toBeUndefined();
  });

  it('validates each value', () => {
    expect(countries.safeParse('IN,india').success).toBe(false);
  });
});
