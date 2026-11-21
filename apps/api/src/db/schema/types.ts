import { customType } from 'drizzle-orm/pg-core';

/** Case-insensitive text (the `citext` extension), for users' sign-in email. */
export const citext = customType<{ data: string }>({ dataType: () => 'citext' });

/** `bytea` as a Node Buffer: session ids and invite tokens are SHA-256 hashes. */
export const bytea = customType<{ data: Buffer }>({ dataType: () => 'bytea' });

/** A slug catalogue id such as `data-analyst` (same rule as `catalogueIdSchema`). */
export const SLUG_PATTERN = `'^[a-z0-9]+(-[a-z0-9]+)*$'`;
