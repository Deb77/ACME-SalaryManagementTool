import { z } from 'zod';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, buildQuery, describeError, fieldErrors, request } from './client';

function mockFetch(status: number, body: unknown) {
  const fetchMock = vi.fn().mockResolvedValue(
    new Response(body === undefined ? null : JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    }),
  );
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

afterEach(() => vi.unstubAllGlobals());

describe('buildQuery', () => {
  it('joins list filters with commas and drops empty values', () => {
    expect(buildQuery({ q: 'rao', country: ['IN', 'GB'], department: [], status: undefined })).toBe(
      '?q=rao&country=IN%2CGB',
    );
    expect(buildQuery({})).toBe('');
  });
});

describe('request', () => {
  it('parses a successful response with the schema', async () => {
    const fetchMock = mockFetch(200, { ok: true });

    await expect(request('/health', z.object({ ok: z.boolean() }))).resolves.toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/health',
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('turns the error envelope into an ApiError with field details', async () => {
    mockFetch(400, {
      error: {
        code: 'validation_error',
        message: 'The request is invalid',
        details: [{ path: 'email', message: 'Invalid email' }],
      },
    });

    const error = await request('/employees', z.unknown(), { method: 'POST', body: {} }).catch(
      (e: unknown) => e,
    );

    expect(error).toBeInstanceOf(ApiError);
    expect(fieldErrors(error)).toEqual({ email: 'Invalid email' });
  });

  it('rejects a response that does not match the contract', async () => {
    mockFetch(200, { ok: 'yes' });

    await expect(request('/health', z.object({ ok: z.boolean() }))).rejects.toMatchObject({
      code: 'invalid_response',
    });
  });

  it('reports a network failure in plain words', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));

    const error = await request('/health', z.unknown()).catch((e: unknown) => e);

    expect(describeError(error)).toBe('Could not reach the server. Check your connection.');
  });
});
