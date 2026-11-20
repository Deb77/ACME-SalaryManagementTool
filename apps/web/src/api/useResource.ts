import { useCallback, useEffect, useEffectEvent, useState } from 'react';

export type ResourceStatus = 'idle' | 'loading' | 'success' | 'error';

export interface Resource<T> {
  status: ResourceStatus;
  /** Data for the current key; undefined while it loads or after an error. */
  data: T | undefined;
  /** Last data that loaded for any key, so a table can keep its rows while the next page loads. */
  previous: T | undefined;
  /**
   * True while `reload()` fetches again for the same key. The old data stays in `data` and
   * `status` stays `success`, so the screen keeps its content instead of flashing a skeleton.
   */
  refreshing: boolean;
  error: unknown;
  reload: () => void;
  /** Replace the data after a write that returned the new value (no refetch). */
  setData: (data: T) => void;
}

interface Settled<T> {
  /** The key the caller passed (without the reload counter). */
  baseKey: string;
  key: string;
  data?: T;
  error?: unknown;
  failed: boolean;
}

/**
 * Loads data for a key and re-loads when the key changes, aborting the previous request.
 * `key: null` means "don't load" (e.g. a permission is missing). Screens use it with the
 * typed functions in `api/endpoints.ts`; components never fetch.
 */
export function useResource<T>(
  key: string | null,
  load: (signal: AbortSignal) => Promise<T>,
): Resource<T> {
  const [reloads, setReloads] = useState(0);
  const requestKey = key === null ? null : `${key}#${reloads}`;
  const [result, setResult] = useState<Settled<T> | null>(null);
  const loadNow = useEffectEvent(load);

  useEffect(() => {
    if (requestKey === null) return;
    const controller = new AbortController();
    const baseKey = requestKey.slice(0, requestKey.lastIndexOf('#'));
    loadNow(controller.signal).then(
      (data) => {
        if (!controller.signal.aborted)
          setResult({ baseKey, key: requestKey, data, failed: false });
      },
      (error: unknown) => {
        if (!controller.signal.aborted)
          setResult({ baseKey, key: requestKey, error, failed: true });
      },
    );
    return () => controller.abort();
  }, [requestKey]);

  const current = result?.key === requestKey ? result : null;
  // A reload of the same key keeps showing the last good data until the new data arrives.
  const stale =
    !current && key !== null && result?.baseKey === key && !result.failed ? result : null;
  const settled = current ?? stale;
  const status: ResourceStatus =
    requestKey === null ? 'idle' : !settled ? 'loading' : settled.failed ? 'error' : 'success';

  const reload = useCallback(() => setReloads((count) => count + 1), []);
  const setData = useCallback(
    (data: T) => {
      if (requestKey !== null)
        setResult({ baseKey: key ?? '', key: requestKey, data, failed: false });
    },
    [key, requestKey],
  );

  return {
    status,
    data: settled && !settled.failed ? settled.data : undefined,
    previous: result?.data,
    refreshing: stale !== null,
    error: settled?.error,
    reload,
    setData,
  };
}
