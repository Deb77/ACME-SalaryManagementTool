import type { z } from 'zod';

/**
 * Human copy for one field's validation failure. Return `undefined` to keep the schema's own
 * message (the shared schemas' messages are written for developers, so screens map the fields
 * people can get wrong).
 */
export type FieldMessage = (issue: z.core.$ZodIssue) => string | undefined;

/**
 * First message per field from a Zod failure, keyed by the top-level field name. `messages`
 * replaces the schema's message for the fields it names.
 */
export function zodFieldErrors(
  error: z.ZodError,
  messages: Partial<Record<string, FieldMessage>> = {},
): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? '');
    errors[key] ??= messages[key]?.(issue) ?? issue.message;
  }
  return errors;
}
