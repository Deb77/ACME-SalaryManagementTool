import type { ReactNode } from 'react';
import { useMemo } from 'react';
import { ApiError, describeError } from '../api/client';
import { getMe, getMeta } from '../api/endpoints';
import { useResource } from '../api/useResource';
import { BootSkeleton } from '../app/BootSkeleton';
import { ErrorState } from '../components';
import { createSession, SessionContext } from './SessionContext';
import styles from './SessionProvider.module.css';

/**
 * Loads who is signed in (`/auth/me`) and the catalogue (`/meta`) once, before any screen
 * renders. Sign-in itself is a separate page (docs/auth.md) that is not built yet.
 */
export function SessionProvider({ children }: { children: ReactNode }) {
  const resource = useResource('session', (signal) =>
    Promise.all([getMe({ signal }), getMeta({ signal })]),
  );
  const session = useMemo(
    () => (resource.data ? createSession(resource.data[0], resource.data[1]) : null),
    [resource.data],
  );

  if (resource.status === 'error') {
    const signedOut =
      resource.error instanceof ApiError && resource.error.code === 'unauthenticated';
    return (
      <div className={styles.centre}>
        <ErrorState
          title={signedOut ? 'You are signed out' : 'ACME People could not start'}
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
