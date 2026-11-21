import type { ReactNode } from 'react';
import { useCallback, useEffect, useMemo } from 'react';
import { Navigate, useLocation } from 'react-router';
import { ApiError, describeError } from '../api/client';
import { getMe, getMeta, signOut } from '../api/endpoints';
import { useResource } from '../api/useResource';
import { BootSkeleton } from '../app/BootSkeleton';
import { ErrorState } from '../components';
import { createSession, SessionContext } from './SessionContext';
import styles from './SessionProvider.module.css';
import { rememberSignedIn } from './signedIn';

/**
 * Loads who is signed in (`/auth/me`) and the catalogue (`/meta`) once, before any screen
 * renders. Without a session it sends the user to the sign-in page and back afterwards.
 */
export function SessionProvider({ children }: { children: ReactNode }) {
  const location = useLocation();
  const resource = useResource('session', (signal) =>
    Promise.all([getMe({ signal }), getMeta({ signal })]),
  );
  const endSession = useCallback(async () => {
    rememberSignedIn(false);
    try {
      await signOut();
    } finally {
      // A full load drops every cached screen, so nothing from this user lingers in memory.
      window.location.assign('/sign-in');
    }
  }, []);
  const session = useMemo(
    () => (resource.data ? createSession(resource.data[0], resource.data[1], endSession) : null),
    [resource.data, endSession],
  );

  const signedOut =
    resource.status === 'error' &&
    resource.error instanceof ApiError &&
    resource.error.code === 'unauthenticated';
  useEffect(() => {
    if (session) rememberSignedIn(true);
    else if (signedOut) rememberSignedIn(false);
  }, [session, signedOut]);

  if (resource.status === 'error') {
    if (signedOut) {
      const next = `${location.pathname}${location.search}`;
      return (
        <Navigate
          to={next === '/' ? '/sign-in' : `/sign-in?next=${encodeURIComponent(next)}`}
          replace
        />
      );
    }
    return (
      <div className={styles.centre}>
        <ErrorState
          title="ACME People could not start"
          description={describeError(resource.error)}
          onRetry={resource.reload}
        />
      </div>
    );
  }
  if (!session) {
    return <BootSkeleton />;
  }
  return <SessionContext.Provider value={session}>{children}</SessionContext.Provider>;
}
