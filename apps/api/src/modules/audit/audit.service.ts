import { randomUUID } from 'node:crypto';
import { and, desc, eq, gte, lt, or, sql, type SQL } from 'drizzle-orm';
import type { AuditAction, AuditEvent, ListAuditEventsQuery } from '@acme/shared';
import type { Actor } from '../../auth/actor.js';
import type { Tx } from '../../db/scope.js';
import { auditEvents, users } from '../../db/schema/index.js';
import { invalid } from '../../lib/errors.js';

type EntityType = (typeof auditEvents.entityType.enumValues)[number];

export interface AuditEntry {
  action: AuditAction;
  entityType: EntityType;
  /** Omitted for things without a row of their own (an export); a fresh id is used. */
  entityId?: string;
  entityLabel: string;
  country?: string | null;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  importId?: string | null;
  details?: Record<string, unknown> | null;
}

/** Only the fields whose values differ, as `{ before, after }`; null when nothing changed. */
export function diff<T extends Record<string, unknown>>(
  before: T,
  after: Partial<T>,
): { before: Partial<T>; after: Partial<T> } | null {
  const b: Partial<T> = {};
  const a: Partial<T> = {};
  for (const key of Object.keys(after) as (keyof T)[]) {
    if (after[key] === undefined) continue;
    if (before[key] !== after[key]) {
      b[key] = before[key];
      a[key] = after[key];
    }
  }
  return Object.keys(a).length > 0 ? { before: b, after: a } : null;
}

interface Cursor {
  /** `occurred_at` as Postgres text, so microseconds survive the round trip. */
  t: string;
  id: string;
}

const encodeCursor = (cursor: Cursor) => Buffer.from(JSON.stringify(cursor)).toString('base64url');

function decodeCursor(raw: string): Cursor {
  try {
    const value = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8')) as Partial<Cursor>;
    if (
      typeof value.t === 'string' &&
      typeof value.id === 'string' &&
      /^[0-9a-f-]{36}$/.test(value.id)
    ) {
      return { t: value.t, id: value.id };
    }
  } catch {
    // fall through
  }
  throw invalid('cursor', 'Invalid cursor');
}

/**
 * Writes audit rows in the caller's transaction (so a change and its audit row commit
 * together) and reads the log with keyset pagination on `(occurred_at, id)`.
 */
export class AuditService {
  async record(tx: Tx, actor: Actor, entry: AuditEntry): Promise<void> {
    await tx.insert(auditEvents).values({
      actorId: actor.userId,
      actorRole: actor.role.key,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId ?? randomUUID(),
      entityLabel: entry.entityLabel,
      countryCode: entry.country ?? null,
      before: entry.before ?? null,
      after: entry.after ?? null,
      importId: entry.importId ?? null,
      details: entry.details ?? null,
    });
  }

  /** Rows are already limited by RLS: in-scope countries, own events, admin events for all-country roles. */
  async list(
    tx: Tx,
    query: ListAuditEventsQuery,
  ): Promise<{ items: AuditEvent[]; nextCursor: string | null }> {
    const conditions: SQL[] = [];
    if (query.entityType) conditions.push(eq(auditEvents.entityType, query.entityType));
    if (query.entityId) conditions.push(eq(auditEvents.entityId, query.entityId));
    if (query.actorId) conditions.push(eq(auditEvents.actorId, query.actorId));
    if (query.action) conditions.push(eq(auditEvents.action, query.action));
    if (query.from) conditions.push(gte(auditEvents.occurredAt, sql`${query.from}::date`));
    if (query.to) conditions.push(lt(auditEvents.occurredAt, sql`${query.to}::date + 1`));
    if (query.cursor) {
      const cursor = decodeCursor(query.cursor);
      conditions.push(
        or(
          lt(auditEvents.occurredAt, sql`${cursor.t}::timestamptz`),
          and(
            eq(auditEvents.occurredAt, sql`${cursor.t}::timestamptz`),
            lt(auditEvents.id, cursor.id),
          ),
        )!,
      );
    }

    const rows = await tx
      .select({
        id: auditEvents.id,
        occurredAt: auditEvents.occurredAt,
        cursorTime: sql<string>`${auditEvents.occurredAt}::text`,
        actorId: auditEvents.actorId,
        actorName: users.name,
        actorRole: auditEvents.actorRole,
        action: auditEvents.action,
        entityType: auditEvents.entityType,
        entityId: auditEvents.entityId,
        entityLabel: auditEvents.entityLabel,
        country: auditEvents.countryCode,
        before: auditEvents.before,
        after: auditEvents.after,
        importId: auditEvents.importId,
        details: auditEvents.details,
      })
      .from(auditEvents)
      .innerJoin(users, eq(users.id, auditEvents.actorId))
      .where(and(...conditions))
      .orderBy(desc(auditEvents.occurredAt), desc(auditEvents.id))
      .limit(query.limit + 1);

    const page = rows.slice(0, query.limit);
    const last = page.at(-1);
    return {
      items: page.map((row) => ({
        id: row.id,
        occurredAt: row.occurredAt.toISOString(),
        actor: { id: row.actorId, name: row.actorName, role: row.actorRole },
        action: row.action,
        entity: { type: row.entityType, id: row.entityId ?? row.id, label: row.entityLabel },
        country: row.country,
        before: row.before as Record<string, unknown> | null,
        after: row.after as Record<string, unknown> | null,
        context: {
          importId: row.importId,
          ...((row.details as Record<string, unknown> | null) ?? {}),
        },
      })),
      nextCursor:
        rows.length > query.limit && last
          ? encodeCursor({ t: last.cursorTime, id: last.id })
          : null,
    };
  }
}
