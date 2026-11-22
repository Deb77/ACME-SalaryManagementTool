import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { meSchema, metaSchema } from '@acme/shared';
import { ORIGIN, PASSWORD, GLOBAL, useTestApi } from '../test/api.js';

/** The HTTP API for auth, permission matrix, catalogue, against its own seeded Postgres with RLS on. */
const api = useTestApi();

describe('auth', () => {
  it('rejects a wrong password with the generic 401', async () => {
    const res = await request(api.app)
      .post('/api/auth/sign-in')
      .set('Origin', ORIGIN)
      .send({ email: GLOBAL, password: 'wrong password!' });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('unauthenticated');
  });

  it('gives the same answer for an unknown email', async () => {
    const res = await request(api.app)
      .post('/api/auth/sign-in')
      .set('Origin', ORIGIN)
      .send({ email: 'nobody@acme.test', password: PASSWORD });
    expect(res.status).toBe(401);
  });

  it('returns the signed-in user with resolved countries', async () => {
    const res = await api.indiaHr.get('/api/auth/me');
    const me = meSchema.parse(res.body);
    expect(me.countries).toEqual(['IN']);
    expect(me.permissions).not.toContain('users:manage');
  });

  it('sets an HttpOnly, SameSite=Lax session cookie', async () => {
    const res = await request(api.app)
      .post('/api/auth/sign-in')
      .set('Origin', ORIGIN)
      .send({ email: GLOBAL, password: PASSWORD });
    const cookie = String(res.headers['set-cookie']);
    expect(cookie).toMatch(/acme_session=/);
    expect(cookie).toMatch(/HttpOnly/);
    expect(cookie).toMatch(/SameSite=Lax/);
  });

  it('blocks state-changing requests from another origin (CSRF)', async () => {
    const res = await api.globalHr
      .post('/api/employees')
      .set('Origin', 'https://evil.test')
      .send({});
    expect(res.status).toBe(403);
    const noOrigin = await api.globalHr.post('/api/employees').send({});
    expect(noOrigin.status).toBe(403);
  });

  it('ends the session on sign-out', async () => {
    const agent = await api.signIn(GLOBAL);
    expect((await api.send(agent, 'post', '/api/auth/sign-out')).status).toBe(204);
    expect((await agent.get('/api/auth/me')).status).toBe(401);
  });
});

describe('permission matrix', () => {
  const routes: [string, string][] = [
    ['get', '/api/meta'],
    ['get', '/api/employees'],
    ['get', '/api/employees/export.csv'],
    ['get', '/api/insights/overview'],
    ['get', '/api/audit-events'],
    ['get', '/api/imports'],
    ['get', '/api/users'],
    ['get', '/api/roles'],
    ['get', '/api/permissions'],
  ];

  it.each(routes)('%s %s needs a session', async (method, path) => {
    const res = await (request(api.app) as unknown as Record<string, (p: string) => request.Test>)[
      method
    ]!(path);
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('unauthenticated');
  });

  it('returns 403 naming the permission Country HR lacks', async () => {
    for (const path of ['/api/users', '/api/permissions', '/api/roles']) {
      const res = await api.indiaHr.get(path);
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('forbidden');
    }
  });
});

describe('catalogue', () => {
  it('serves meta with an ETag and answers 304 when unchanged', async () => {
    const res = await api.globalHr.get('/api/meta');
    metaSchema.parse(res.body);
    const again = await api.globalHr.get('/api/meta').set('If-None-Match', res.headers.etag!);
    expect(again.status).toBe(304);
  });
});
