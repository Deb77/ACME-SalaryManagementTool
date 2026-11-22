import type { CountryInfo, Me, Meta, Permission } from '@acme/shared';
import { createContext, useContext } from 'react';

export interface Session {
  me: Me;
  meta: Meta;
  can: (permission: Permission) => boolean;
  country: (code: string) => CountryInfo | undefined;
  countryName: (code: string) => string;
  /**
   * Ends the session on the server and returns to the sign-in page. Rejects, leaving the user
   * signed in, when the server did not end it.
   */
  signOut: () => Promise<void>;
}

export const SessionContext = createContext<Session | null>(null);

/** The signed-in user and the catalogue. Only screens (containers) read it. */
export function useSession(): Session {
  const session = useContext(SessionContext);
  if (!session) throw new Error('useSession must be used inside SessionProvider');
  return session;
}

/**
 * The session, or null while it is still loading. For skeletons, which draw before the user
 * is known and assume the common case (everything visible) until it is.
 */
export function useOptionalSession(): Session | null {
  return useContext(SessionContext);
}

export function createSession(
  me: Me,
  meta: Meta,
  signOut: () => Promise<void> = async () => {},
): Session {
  const byCode = new Map(meta.countries.map((country) => [country.code, country]));
  return {
    me,
    meta,
    can: (permission) => me.permissions.includes(permission),
    country: (code) => byCode.get(code),
    countryName: (code) => byCode.get(code)?.name ?? code,
    signOut,
  };
}
