import type { ReactNode } from 'react';
import { describeError } from '../../api/client';
import { ErrorState, LoadingState, type LoadingShape } from '../../components';

export interface ResourceStateProps {
  status: 'idle' | 'loading' | 'success' | 'error';
  error?: unknown;
  onRetry?: () => void;
  loadingLabel?: string;
  /**
   * The content's own placeholder, e.g. a DataTable with `skeletonRows` or the real list
   * markup with Skeleton values. Preferred over `loadingShape`, which is a generic sketch.
   */
  skeleton?: ReactNode;
  /** Generic skeleton layout, used when there is no `skeleton`. */
  loadingShape?: LoadingShape;
  loadingRows?: number;
  /** What failed, e.g. "Salary history could not load". */
  errorTitle?: string;
  children: ReactNode;
}

/** Loading and error states for one async card; renders the children once data is there. */
export function ResourceState({
  status,
  error,
  onRetry,
  loadingLabel = 'Loading…',
  skeleton,
  loadingShape,
  loadingRows,
  errorTitle,
  children,
}: ResourceStateProps) {
  if (status === 'loading') {
    if (skeleton) {
      return (
        // Flex so a filling DataTable placeholder can still take the card's height.
        <div
          role="status"
          aria-live="polite"
          aria-busy="true"
          aria-label={loadingLabel}
          style={{ display: 'flex', flex: 1, flexDirection: 'column', minHeight: 0 }}
        >
          {skeleton}
        </div>
      );
    }
    return <LoadingState label={loadingLabel} shape={loadingShape} rows={loadingRows} />;
  }
  if (status === 'error') {
    return <ErrorState title={errorTitle} description={describeError(error)} onRetry={onRetry} />;
  }
  return <>{children}</>;
}
