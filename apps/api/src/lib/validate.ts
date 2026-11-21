import { validationErrorBody } from '@acme/shared';
import type { z } from 'zod';
import { AppError } from './errors.js';

/** Parses untrusted input with a shared schema; failures become `400 validation_error`. */
export function parse<S extends z.ZodType>(schema: S, input: unknown): z.infer<S> {
  const result = schema.safeParse(input);
  if (!result.success) {
    const { error } = validationErrorBody(result.error);
    throw new AppError('validation_error', error.message, error.details);
  }
  return result.data;
}
