import type { z } from 'zod';

/** First message per field from a Zod failure, keyed by the top-level field name. */
export function zodFieldErrors(error: z.ZodError): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? '');
    errors[key] ??= issue.message;
  }
  return errors;
}
