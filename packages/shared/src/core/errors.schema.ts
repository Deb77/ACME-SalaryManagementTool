import { z } from 'zod';

export const apiErrorCodes = [
  'validation_error',
  'unauthenticated',
  'forbidden',
  'not_found',
  'conflict',
  'stale_version',
  'payload_too_large',
  'rate_limited',
  'ai_budget_exceeded',
  'draft_stale',
  'draft_applied',
  'ai_unavailable',
  'internal_error',
] as const;

export type ApiErrorCode = (typeof apiErrorCodes)[number];

/** The one place that decides which HTTP status each error code uses. */
export const apiErrorStatus = {
  validation_error: 400,
  unauthenticated: 401,
  forbidden: 403,
  not_found: 404,
  conflict: 409,
  stale_version: 409,
  payload_too_large: 413,
  rate_limited: 429,
  ai_budget_exceeded: 429,
  draft_stale: 409,
  draft_applied: 409,
  internal_error: 500,
  ai_unavailable: 503,
} as const satisfies Record<ApiErrorCode, number>;

export const apiErrorDetailSchema = z.object({
  /** Dotted path to the offending field, e.g. `salary.amountMinor`; empty for the whole body. */
  path: z.string(),
  message: z.string(),
});

export const apiErrorBodySchema = z.object({
  error: z.object({
    code: z.enum(apiErrorCodes),
    message: z.string(),
    details: z.array(apiErrorDetailSchema).optional(),
  }),
});

export type ApiErrorBody = z.infer<typeof apiErrorBodySchema>;

/** Turns a Zod failure into the API's 400 body, one detail per issue. */
export function validationErrorBody(error: z.ZodError): ApiErrorBody {
  return {
    error: {
      code: 'validation_error',
      message: 'The request is invalid',
      details: error.issues.map((issue) => ({
        path: issue.path.map(String).join('.'),
        message: issue.message,
      })),
    },
  };
}
