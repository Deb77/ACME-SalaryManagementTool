import type { CountryScope, Me, Permission } from '@acme/shared';
import { forbidden } from '../lib/errors.js';

/** The signed-in user for one request, re-read from the database on every request. */
export interface Actor {
  userId: string;
  email: string;
  name: string;
  role: { id: string; key: string; name: string; countryScope: CountryScope };
  permissions: ReadonlySet<Permission>;
  /** Resolved countries: every country for an `all` role, the assigned ones otherwise. */
  countries: readonly string[];
  /** SHA-256 of the session token, for sign-out. */
  sessionId: Buffer;
}

export const canUseCountry = (actor: Actor, country: string) => actor.countries.includes(country);

/**
 * A country the user named themselves (a form field, a filter, a role's countries) must be one
 * they can see: 403 on that field, not 404, since they chose it (docs/api.md).
 */
export function assertCountryInScope(actor: Actor, country: string, path = 'country'): void {
  if (!canUseCountry(actor, country)) {
    throw forbidden(`${country} is outside your countries`, [
      { path, message: 'Outside your countries' },
    ]);
  }
}

export function toMe(actor: Actor): Me {
  return {
    id: actor.userId,
    email: actor.email,
    name: actor.name,
    role: actor.role,
    permissions: [...actor.permissions],
    countries: [...actor.countries],
  };
}
