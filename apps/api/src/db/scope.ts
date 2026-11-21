import { sql } from 'drizzle-orm';
import type { Actor } from '../auth/actor.js';
import type { Db } from './database.js';

/** A transaction on the API pool. Repositories only ever receive one of these. */
export type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];

/**
 * Runs `fn` in one transaction scoped to the actor (docs/auth.md, RLS policies): it sets the
 * transaction-local `app.user_id`, `app.countries` and `app.all_countries`, which the row-level
 * security policies read. The settings vanish at commit or rollback, so a pooled connection
 * never carries one user's scope into another request.
 */
export class ScopedDb {
  constructor(private readonly db: Db) {}

  run<T>(actor: Actor, fn: (tx: Tx) => Promise<T>): Promise<T> {
    return this.db.transaction(async (tx) => {
      await tx.execute(sql`select
        set_config('app.user_id', ${actor.userId}, true),
        set_config('app.countries', ${actor.countries.join(',')}, true),
        set_config('app.all_countries', ${actor.role.countryScope === 'all' ? 'on' : 'off'}, true)`);
      return fn(tx);
    });
  }

  /** For auth and catalogue reads that happen before a scope exists (tables without RLS). */
  get unscoped(): Db {
    return this.db;
  }
}
