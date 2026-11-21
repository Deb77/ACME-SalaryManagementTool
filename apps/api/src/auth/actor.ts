import type { CountryScope, Me, Permission } from '@acme/shared';

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
