import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { healthResponseSchema } from '@acme/shared';
import { createApp } from './app.js';

describe('GET /api/health', () => {
  it('reports that the API is up', async () => {
    const res = await request(createApp()).get('/api/health');

    expect(res.status).toBe(200);
    expect(healthResponseSchema.parse(res.body)).toEqual({ status: 'ok' });
  });

  it('returns 404 for unknown routes', async () => {
    const res = await request(createApp()).get('/api/nope');

    expect(res.status).toBe(404);
  });
});

describe('serving the built web app', () => {
  let webDist: string;

  beforeAll(() => {
    webDist = mkdtempSync(join(tmpdir(), 'acme-web-'));
    writeFileSync(join(webDist, 'index.html'), '<!doctype html><title>ACME</title>');
    mkdirSync(join(webDist, 'assets'));
    writeFileSync(join(webDist, 'assets', 'app.js'), 'console.log("app");');
  });

  afterAll(() => rmSync(webDist, { recursive: true, force: true }));

  it('serves the app shell at the root', async () => {
    const res = await request(createApp({ webDist })).get('/');

    expect(res.status).toBe(200);
    expect(res.text).toContain('<title>ACME</title>');
  });

  it('serves static assets', async () => {
    const res = await request(createApp({ webDist })).get('/assets/app.js');

    expect(res.status).toBe(200);
    expect(res.text).toContain('console.log("app")');
  });

  it('serves the app shell for client-side routes', async () => {
    const res = await request(createApp({ webDist })).get('/employees/42');

    expect(res.status).toBe(200);
    expect(res.text).toContain('<title>ACME</title>');
  });

  it('still returns 404 for unknown API routes', async () => {
    const res = await request(createApp({ webDist })).get('/api/nope');

    expect(res.status).toBe(404);
  });
});
