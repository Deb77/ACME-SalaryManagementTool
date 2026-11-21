import { apiErrorBodySchema, type ApiErrorCode } from '@acme/shared';
import type { z } from 'zod';

/** A failed API call, carrying the error envelope from docs/api.md. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: ApiErrorCode | 'network_error' | 'invalid_response',
    message: string,
    readonly details: readonly { path: string; message: string }[] = [],
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  /** JSON body; a FormData body is sent as multipart. */
  body?: unknown;
  signal?: AbortSignal;
}

/** Base path of the API (same origin, see docs/api.md). */
export const API_BASE = '/api';

export function buildQuery(
  params: Record<string, string | number | readonly string[] | undefined>,
) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === '') continue;
    if (Array.isArray(value)) {
      if (value.length > 0) search.set(key, value.join(','));
    } else {
      search.set(key, String(value));
    }
  }
  const text = search.toString();
  return text ? `?${text}` : '';
}

/** Sends a request and parses the response with the shared Zod schema. */
export async function request<S extends z.ZodType>(
  path: string,
  schema: S,
  options?: RequestOptions,
): Promise<z.infer<S>>;
export async function request(path: string, schema: null, options?: RequestOptions): Promise<void>;
export async function request(
  path: string,
  schema: z.ZodType | null,
  { method = 'GET', body, signal }: RequestOptions = {},
): Promise<unknown> {
  const isForm = typeof FormData !== 'undefined' && body instanceof FormData;
  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      method,
      signal,
      credentials: 'same-origin',
      headers: {
        Accept: 'application/json',
        ...(body !== undefined && !isForm ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body === undefined ? undefined : isForm ? (body as FormData) : JSON.stringify(body),
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    throw new ApiError(0, 'network_error', 'Could not reach the server. Check your connection.');
  }

  if (!response.ok) throw await toApiError(response);
  if (schema === null || response.status === 204) return undefined;

  const parsed = schema.safeParse(await response.json().catch(() => undefined));
  if (!parsed.success) {
    throw new ApiError(
      response.status,
      'invalid_response',
      'The server sent an unexpected response.',
    );
  }
  return parsed.data;
}

export async function toApiError(response: Response): Promise<ApiError> {
  const parsed = apiErrorBodySchema.safeParse(await response.json().catch(() => undefined));
  if (parsed.success) {
    const { code, message, details } = parsed.data.error;
    return new ApiError(response.status, code, message, details);
  }
  return new ApiError(response.status, 'internal_error', 'Something went wrong on the server.');
}

/** Field errors from a 400 `validation_error`, keyed by the request field path. */
export function fieldErrors(error: unknown): Record<string, string> {
  if (!(error instanceof ApiError) || error.code !== 'validation_error') return {};
  return Object.fromEntries(error.details.map((detail) => [detail.path, detail.message]));
}

/** A sentence a person can act on, for ErrorState and form-level messages. */
export function describeError(error: unknown): string {
  if (!(error instanceof ApiError)) return 'Something went wrong. Try again.';
  switch (error.code) {
    case 'unauthenticated':
      return 'Your session has ended. Sign in again to continue.';
    case 'forbidden':
      return "You don't have access to this. Ask Global HR if you need it.";
    case 'not_found':
      return 'We could not find this. It may have been removed or be outside your countries.';
    case 'stale_version':
      return 'Someone else changed this record while you were editing. Reload and try again.';
    case 'rate_limited':
      return 'Too many questions in a short time. Wait a minute and try again.';
    case 'ai_budget_exceeded':
      // The server says which budget: this conversation (start a new one) or today's.
      return error.message;
    case 'ai_unavailable':
      return 'Ask AI is unavailable right now. Try again in a minute; the rest of the app still works.';
    case 'draft_stale':
    case 'draft_applied':
      return 'This draft is out of date — ask again.';
    default:
      return error.message;
  }
}
