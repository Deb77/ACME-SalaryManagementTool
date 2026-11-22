import type { ApiErrorCode } from '@acme/shared';
import type { RuleViolation } from './violation.js';

export interface ErrorDetail {
  path: string;
  message: string;
}

/**
 * A failure the client can act on. Services throw these; the error middleware turns them into
 * the shared envelope with the status from `apiErrorStatus`. Routes never build error bodies.
 */
export class AppError extends Error {
  constructor(
    readonly code: ApiErrorCode,
    message: string,
    readonly details?: ErrorDetail[],
    readonly headers?: Record<string, string>,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const notFound = (what = 'Not found') => new AppError('not_found', what);

export const forbidden = (message = "You don't have access to this", details?: ErrorDetail[]) =>
  new AppError('forbidden', message, details);

export const conflict = (message: string, details?: ErrorDetail[]) =>
  new AppError('conflict', message, details);

export const staleVersion = () =>
  new AppError('stale_version', 'Someone else changed this record. Reload it and try again.');

export const unauthenticated = () => new AppError('unauthenticated', 'Sign in to continue');

/** A domain rule failed for one field, e.g. an effective date before the latest entry. */
export const invalid = (path: string, message: string) =>
  new AppError('validation_error', 'The request is invalid', [{ path, message }]);

export function assertFound<T>(value: T | undefined | null, what?: string): T {
  if (value === undefined || value === null) throw notFound(what);
  return value;
}

/** The client-facing error for a broken domain rule (lib/violation.ts). */
export function toAppError(violation: RuleViolation): AppError {
  if (violation.kind === 'stale') return staleVersion();
  if (violation.kind === 'conflict') return conflict(violation.message);
  return invalid(violation.field ?? '', violation.message);
}

/** Throws the client-facing error when a rule was broken. */
export function assertNoViolation(violation: RuleViolation | null): void {
  if (violation) throw toAppError(violation);
}
