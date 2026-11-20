import { z } from 'zod';

export const MAX_PAGE_SIZE = 100;

/** Offset pagination for the employee list: page numbers and a total suit an HR table. */
export const pageQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(25),
});

export type PageQuery = z.infer<typeof pageQuerySchema>;

export function pageSchema<T extends z.ZodType>(item: T) {
  return z.object({
    items: z.array(item),
    page: z.int().min(1),
    pageSize: z.int().min(1),
    total: z.int().nonnegative(),
  });
}

/** Cursor pagination for append-only, ever-growing feeds (audit log). */
export const cursorQuerySchema = z.object({
  cursor: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(50),
});

export type CursorQuery = z.infer<typeof cursorQuerySchema>;

export function cursorPageSchema<T extends z.ZodType>(item: T) {
  return z.object({
    items: z.array(item),
    /** Opaque; `null` when there are no more items. */
    nextCursor: z.string().nullable(),
  });
}

export interface Sort<F extends string> {
  field: F;
  direction: 'asc' | 'desc';
}

/** `sort=name` sorts ascending, `sort=-hireDate` descending. Only allow-listed fields. */
export function sortSchema<F extends string>(fields: readonly F[], defaultSort: F | `-${F}`) {
  return z
    .string()
    .default(defaultSort)
    .transform((raw, ctx): Sort<F> => {
      const direction = raw.startsWith('-') ? 'desc' : 'asc';
      const field = direction === 'desc' ? raw.slice(1) : raw;
      if (!(fields as readonly string[]).includes(field)) {
        ctx.issues.push({
          code: 'custom',
          input: raw,
          message: `Sort by one of: ${fields.join(', ')} (prefix with "-" for descending)`,
        });
        return z.NEVER;
      }
      return { field: field as F, direction };
    });
}

/** Accepts `?country=IN&country=GB` and `?country=IN,GB`; empty means "no filter". */
export function listParamSchema<T extends z.ZodType>(item: T) {
  return z.preprocess((value) => {
    if (value === undefined || value === '') return undefined;
    const values = (Array.isArray(value) ? value : [value]).flatMap((v) => String(v).split(','));
    const cleaned = values.map((v) => v.trim()).filter(Boolean);
    return cleaned.length > 0 ? cleaned : undefined;
  }, z.array(item).optional());
}
