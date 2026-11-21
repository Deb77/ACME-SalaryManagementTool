import type { Request, RequestHandler } from 'express';
import { AppError } from './errors.js';

export interface RateLimitOptions {
  limit: number;
  windowMs: number;
  /** Bucket key; defaults to the client IP. */
  key?: (req: Request) => string;
  /** Count only failed responses (status >= 400), so normal use never trips the limit. */
  failuresOnly?: boolean;
}

/**
 * Fixed-window, in-memory limiter (docs/auth.md, Sign-in protection). One Render instance
 * means one memory; scaling out would need a shared store. For sign-in it counts failures per
 * IP and email, so an office behind one NAT is not locked out by its colleagues' logins.
 */
export function rateLimit({
  limit,
  windowMs,
  key,
  failuresOnly = false,
}: RateLimitOptions): RequestHandler {
  const hits = new Map<string, { count: number; resetAt: number }>();

  const entryFor = (bucket: string, now: number) => {
    let entry = hits.get(bucket);
    if (!entry || entry.resetAt <= now) {
      entry = { count: 0, resetAt: now + windowMs };
      hits.set(bucket, entry);
      if (hits.size > 10_000) {
        for (const [k, v] of hits) if (v.resetAt <= now) hits.delete(k);
      }
    }
    return entry;
  };

  return (req, res, next) => {
    const now = Date.now();
    const bucket = key ? key(req) : (req.ip ?? 'unknown');
    const entry = entryFor(bucket, now);
    if (entry.count >= limit) {
      const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
      next(
        new AppError(
          'rate_limited',
          'Too many attempts. Wait a few minutes and try again.',
          undefined,
          {
            'Retry-After': String(retryAfter),
          },
        ),
      );
      return;
    }
    if (failuresOnly) {
      res.on('finish', () => {
        if (res.statusCode >= 400 && res.statusCode !== 429)
          entryFor(bucket, Date.now()).count += 1;
      });
    } else {
      entry.count += 1;
    }
    next();
  };
}
