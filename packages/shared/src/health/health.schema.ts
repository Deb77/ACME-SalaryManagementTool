import { z } from 'zod';

export const healthResponseSchema = z.object({
  status: z.literal('ok'),
  /** Ask AI readiness, without secrets. Absent when the server runs without a database. */
  ai: z
    .object({
      /** An Anthropic API key is set. */
      configured: z.boolean(),
      /** The `acme_ai_reader` pool (DATABASE_URL_AI). */
      database: z.enum(['ok', 'unreachable', 'not_configured']),
    })
    .optional(),
});

export type HealthResponse = z.infer<typeof healthResponseSchema>;
