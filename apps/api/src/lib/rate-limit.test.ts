import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { rateLimit } from './rate-limit.js';
import { errorHandler } from './http.js';

function appWith(failuresOnly: boolean) {
  const app = express();
  app.use(express.json());
  app.post(
    '/try',
    rateLimit({ limit: 2, windowMs: 60_000, failuresOnly, key: (req) => String(req.body.email) }),
    (req, res) => {
      res.status(req.body.ok ? 200 : 401).end();
    },
  );
  app.use(errorHandler({ error: () => {}, info: () => {} }));
  return app;
}

describe('rateLimit', () => {
  it('counts only failures when asked, so successful sign-ins never lock anyone out', async () => {
    const app = appWith(true);
    for (let i = 0; i < 5; i += 1) {
      expect((await request(app).post('/try').send({ email: 'a', ok: true })).status).toBe(200);
    }
    expect((await request(app).post('/try').send({ email: 'a', ok: false })).status).toBe(401);
    expect((await request(app).post('/try').send({ email: 'a', ok: false })).status).toBe(401);
    const blocked = await request(app).post('/try').send({ email: 'a', ok: true });
    expect(blocked.status).toBe(429);
    expect(blocked.headers['retry-after']).toBeDefined();
    // Another key (a colleague's email) is unaffected.
    expect((await request(app).post('/try').send({ email: 'b', ok: true })).status).toBe(200);
  });

  it('counts every request otherwise', async () => {
    const app = appWith(false);
    await request(app).post('/try').send({ email: 'a', ok: true });
    await request(app).post('/try').send({ email: 'a', ok: true });
    expect((await request(app).post('/try').send({ email: 'a', ok: true })).status).toBe(429);
  });
});
