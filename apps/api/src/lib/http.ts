import type { ErrorRequestHandler, Request, RequestHandler, Response } from 'express';
import { apiErrorStatus, type ApiErrorBody } from '@acme/shared';
import type { Actor } from '../auth/actor.js';
import { AppError, forbidden, unauthenticated } from './errors.js';
import type { Permission } from '@acme/shared';

declare module 'express-serve-static-core' {
  interface Request {
    /** Set by `loadSession` when the cookie names a live session. */
    actor?: Actor;
  }
}

/** Narrowing helper for handlers mounted behind `requireAuth`/`requirePermission`. */
export function actorOf(req: Request): Actor {
  if (!req.actor) throw unauthenticated();
  return req.actor;
}

export const requireAuth: RequestHandler = (req, _res, next) => {
  next(req.actor ? undefined : unauthenticated());
};

/** Route guard: the actor's role must grant every listed permission (403 names the first gap). */
export const requirePermission =
  (...needed: Permission[]): RequestHandler =>
  (req, _res, next) => {
    const actor = req.actor;
    if (!actor) return next(unauthenticated());
    const missing = needed.find((permission) => !actor.permissions.has(permission));
    if (missing) {
      return next(
        forbidden(`Your role does not include "${missing}"`, [
          { path: 'permission', message: missing },
        ]),
      );
    }
    next();
  };

/** For the one route open to either of two permissions (`GET /api/roles`). */
export const requireAnyPermission =
  (...options: Permission[]): RequestHandler =>
  (req, _res, next) => {
    const actor = req.actor;
    if (!actor) return next(unauthenticated());
    if (!options.some((permission) => actor.permissions.has(permission))) {
      return next(
        forbidden(`Your role needs one of ${options.join(', ')}`, [
          { path: 'permission', message: options.join(' | ') },
        ]),
      );
    }
    next();
  };

const UNSAFE = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * CSRF defence on top of `SameSite=Lax` (docs/auth.md, Sessions, cookies and CSRF): a
 * state-changing request must come from an allowed Origin, or, without an Origin header, be
 * marked same-origin by the browser.
 */
export const originCheck =
  (allowedOrigins: readonly string[]): RequestHandler =>
  (req, _res, next) => {
    if (!UNSAFE.has(req.method)) return next();
    const origin = req.get('origin');
    const ok = origin
      ? allowedOrigins.includes(origin)
      : req.get('sec-fetch-site') === 'same-origin';
    next(ok ? undefined : forbidden('Cross-site request blocked'));
  };

/** API responses hold pay data: never cache them in shared or browser caches. */
export const noStore: RequestHandler = (_req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
};

/** A few security headers; the CSP is strict because the UI is same-origin. */
export const securityHeaders: RequestHandler = (_req, res, next) => {
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'same-origin',
    'X-Frame-Options': 'DENY',
    'Content-Security-Policy':
      "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; font-src 'self' data:; object-src 'none'; frame-ancestors 'none'; base-uri 'self'",
  });
  next();
};

export function sendError(res: Response, error: AppError) {
  const body: ApiErrorBody = {
    error: {
      code: error.code,
      message: error.message,
      ...(error.details ? { details: error.details } : {}),
    },
  };
  if (error.headers) res.set(error.headers);
  res.status(apiErrorStatus[error.code]).json(body);
}

interface PgError {
  code?: string;
  constraint?: string;
}

/** Postgres errors the client can act on. Everything else is a 500 with a generic message. */
function fromPostgres(error: unknown): AppError | undefined {
  const cause = (error as { cause?: unknown }).cause ?? error;
  const pg = cause as PgError;
  switch (pg.code) {
    case '23505': {
      const constraint = (pg.constraint ?? '').toLowerCase().replace(/_/g, '');
      if (constraint.includes('email')) {
        return new AppError('conflict', 'This email is already in use', [
          { path: 'email', message: 'Already in use' },
        ]);
      }
      if (constraint.includes('employeecode')) {
        return new AppError('conflict', 'This employee code is already in use', [
          { path: 'employeeCode', message: 'Already in use' },
        ]);
      }
      if (constraint.includes('name')) {
        return new AppError('conflict', 'This name is already in use', [
          { path: 'name', message: 'Already in use' },
        ]);
      }
      return new AppError('conflict', 'This record already exists');
    }
    // RLS rejected a row (WITH CHECK): looks the same as a missing one.
    case '42501':
      return new AppError('not_found', 'Not found');
    case '23503':
    case '23514':
      return new AppError('validation_error', 'The request breaks a data rule', [
        { path: '', message: pg.constraint ?? 'constraint' },
      ]);
    default:
      return undefined;
  }
}

export interface Logger {
  error(message: string, meta?: Record<string, unknown>): void;
  info(message: string, meta?: Record<string, unknown>): void;
}

export const consoleLogger: Logger = {
  error: (message, meta) => console.error(JSON.stringify({ level: 'error', message, ...meta })),
  info: (message, meta) => console.log(JSON.stringify({ level: 'info', message, ...meta })),
};

export const errorHandler =
  (logger: Logger): ErrorRequestHandler =>
  (error: unknown, req, res, next) => {
    if (res.headersSent) return next(error);
    if (error instanceof AppError) return sendError(res, error);

    const status = (error as { status?: number; type?: string }).status;
    const type = (error as { type?: string }).type;
    if (type === 'entity.parse.failed') {
      return sendError(res, new AppError('validation_error', 'The request body is not valid JSON'));
    }
    if (status === 413 || (error as { code?: string }).code === 'LIMIT_FILE_SIZE') {
      return sendError(res, new AppError('payload_too_large', 'The file is larger than 5 MB'));
    }
    const mapped = fromPostgres(error);
    if (mapped) return sendError(res, mapped);

    logger.error('unhandled error', {
      method: req.method,
      path: req.path,
      error: error instanceof Error ? { message: error.message, stack: error.stack } : error,
    });
    sendError(res, new AppError('internal_error', 'Something went wrong. Try again.'));
  };

/** Parses the Cookie header (no dependency needed for one cookie). */
export function readCookie(req: Request, name: string): string | undefined {
  const header = req.headers.cookie;
  if (!header) return undefined;
  for (const part of header.split(';')) {
    const index = part.indexOf('=');
    if (index === -1) continue;
    if (part.slice(0, index).trim() === name) {
      try {
        return decodeURIComponent(part.slice(index + 1).trim());
      } catch {
        return undefined;
      }
    }
  }
  return undefined;
}
