import request from 'supertest';
import { describe, expect, it } from 'vitest';
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
