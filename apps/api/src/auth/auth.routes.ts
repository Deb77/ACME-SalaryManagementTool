import {
  Router,
  type CookieOptions,
  type Request,
  type RequestHandler,
  type Response,
} from 'express';
import { acceptInviteRequestSchema, signInRequestSchema } from '@acme/shared';
import type { Config } from '../config.js';
import { actorOf, readCookie, requireAuth } from '../lib/http.js';
import { rateLimit } from '../lib/rate-limit.js';
import { parse } from '../lib/validate.js';
import { toMe } from './actor.js';
import { SESSION_ABSOLUTE_MS, type AuthService } from './auth.service.js';

/** `__Host-` forbids a Domain attribute, so no subdomain can set or read the cookie. */
export const sessionCookieName = (config: Pick<Config, 'secureCookies'>) =>
  config.secureCookies ? '__Host-acme_session' : 'acme_session';

/** Reads the session cookie and attaches the actor. Never fails: routes decide if auth is needed. */
export function loadSession(auth: AuthService, config: Config): RequestHandler {
  const name = sessionCookieName(config);
  return async (req, _res, next) => {
    const token = readCookie(req, name);
    if (token) req.actor = await auth.actorForToken(token);
    next();
  };
}

export function authRoutes(auth: AuthService, config: Config): Router {
  const router = Router();
  const name = sessionCookieName(config);
  const cookie: CookieOptions = {
    httpOnly: true,
    secure: config.secureCookies,
    sameSite: 'lax',
    path: '/',
  };
  const setSession = (res: Response, token: string) =>
    res.cookie(name, token, { ...cookie, maxAge: SESSION_ABSOLUTE_MS });
  const client = (req: Request) => ({ ip: req.ip, userAgent: req.get('user-agent') });
  // 10 failed attempts per 15 minutes per IP and email on sign-in (50 per IP overall), and
  // 10 per IP on invite links. Successful sign-ins never count.
  const windowMs = 15 * 60 * 1000;
  const limit = config.authRateLimit ?? 10;
  const signInLimit = rateLimit({
    limit,
    windowMs,
    failuresOnly: true,
    key: (req) => {
      const email: unknown = (req.body as { email?: unknown } | undefined)?.email;
      return `${req.ip}|${typeof email === 'string' ? email.trim().toLowerCase() : ''}`;
    },
  });
  const limited = rateLimit({ limit, windowMs, failuresOnly: true });
  // Credential stuffing tries many emails from one IP: a looser cap on all failures per IP.
  const ipLimit = rateLimit({ limit: limit * 5, windowMs, failuresOnly: true });

  router.post('/sign-in', ipLimit, signInLimit, async (req, res) => {
    const { email, password } = parse(signInRequestSchema, req.body);
    const { token, actor } = await auth.signIn(email, password, client(req));
    setSession(res, token);
    res.json(toMe(actor));
  });

  router.post('/sign-out', async (req, res) => {
    if (req.actor) await auth.signOut(req.actor.sessionId);
    res.clearCookie(name, cookie);
    res.status(204).end();
  });

  router.get('/me', requireAuth, (req, res) => {
    res.json(toMe(actorOf(req)));
  });

  router.get('/invites/:token', limited, async (req, res) => {
    res.json(await auth.inviteInfo(String(req.params.token)));
  });

  router.post('/accept-invite', limited, async (req, res) => {
    const body = parse(acceptInviteRequestSchema, req.body);
    const { token, actor } = await auth.acceptInvite(body, client(req));
    setSession(res, token);
    res.json(toMe(actor));
  });

  return router;
}
