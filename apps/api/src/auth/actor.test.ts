import { describe, expect, it } from 'vitest';
import { AppError } from '../lib/errors.js';
import { assertCountryInScope, type Actor } from './actor.js';

const countryHr: Actor = {
  userId: 'u1',
  email: 'hr.in@acme.test',
  name: 'India HR',
  role: { id: 'r1', key: 'country_hr', name: 'Country HR', countryScope: 'assigned' },
  permissions: new Set(),
  countries: ['IN'],
  sessionId: Buffer.alloc(0),
};

describe('assertCountryInScope', () => {
  it('lets a country the user can see through', () => {
    expect(() => assertCountryInScope(countryHr, 'IN')).not.toThrow();
  });

  it('refuses a country outside the user’s scope with a 403 on the field', () => {
    let error: unknown;
    try {
      assertCountryInScope(countryHr, 'US', 'countries');
    } catch (caught) {
      error = caught;
    }
    expect(error).toBeInstanceOf(AppError);
    expect(error).toMatchObject({
      code: 'forbidden',
      message: 'US is outside your countries',
      details: [{ path: 'countries', message: 'Outside your countries' }],
    });
  });

  it('names the country field by default', () => {
    expect(() => assertCountryInScope(countryHr, 'GB')).toThrow(
      expect.objectContaining({
        details: [{ path: 'country', message: 'Outside your countries' }],
      }),
    );
  });
});
