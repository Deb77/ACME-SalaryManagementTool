import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { apiErrorBodySchema, apiErrorStatus, validationErrorBody } from './errors.schema.js';

describe('validationErrorBody', () => {
  it('lists every invalid field with a dotted path', () => {
    const schema = z.object({ salary: z.object({ amountMinor: z.int() }), email: z.email() });
    const result = schema.safeParse({ salary: { amountMinor: 1.5 }, email: 'nope' });
    if (result.success) throw new Error('expected failure');

    const body = validationErrorBody(result.error);

    expect(body.error.code).toBe('validation_error');
    expect(body.error.details?.map((d) => d.path)).toEqual(['salary.amountMinor', 'email']);
    expect(apiErrorBodySchema.parse(body)).toEqual(body);
  });
});

describe('apiErrorStatus', () => {
  it('maps domain errors to 400, 404 and 409', () => {
    expect(apiErrorStatus.validation_error).toBe(400);
    expect(apiErrorStatus.not_found).toBe(404);
    expect(apiErrorStatus.conflict).toBe(409);
    expect(apiErrorStatus.stale_version).toBe(409);
  });
});

describe('apiErrorBodySchema', () => {
  it('matches the existing unknown-route 404 body', () => {
    const body = { error: { code: 'not_found', message: 'Route not found' } };
    expect(apiErrorBodySchema.parse(body)).toEqual(body);
  });

  it('rejects error codes that are not part of the contract', () => {
    const body = { error: { code: 'teapot', message: 'Nope' } };
    expect(apiErrorBodySchema.safeParse(body).success).toBe(false);
  });
});
