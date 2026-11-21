import type { Request } from 'express';
import { z } from 'zod';
import { notFound } from './errors.js';

const uuid = z.uuid();

/** A path id that is not a UUID cannot exist: answer 404 rather than a database error. */
export function idParam(req: Request, name = 'id'): string {
  const value = req.params[name];
  if (!uuid.safeParse(value).success) throw notFound();
  return value as string;
}
