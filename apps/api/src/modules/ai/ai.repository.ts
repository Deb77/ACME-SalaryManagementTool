import { and, asc, desc, eq, gte, ilike, inArray, lt, or, sql, type SQL } from 'drizzle-orm';
import type { AiSqlRun, ListAiSqlRunsQuery } from '@acme/shared';
import type { Tx } from '../../db/scope.js';
import {
  aiConversations,
  aiMessages,
  aiSalaryDrafts,
  aiSqlRuns,
  employees,
  jobTitles,
  users,
} from '../../db/schema/index.js';
import { invalid } from '../../lib/errors.js';

export type AiMessageRow = typeof aiMessages.$inferSelect;
export type AiDraftRow = typeof aiSalaryDrafts.$inferSelect;
export type AiSqlRunInsert = typeof aiSqlRuns.$inferInsert;

const likeEscape = (value: string) => value.replace(/[\\%_]/g, (c) => `\\${c}`);

interface Cursor {
  t: string;
  id: string;
}
const encodeCursor = (cursor: Cursor) => Buffer.from(JSON.stringify(cursor)).toString('base64url');
function decodeCursor(raw: string): Cursor {
  try {
    const value = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8')) as Partial<Cursor>;
    if (typeof value.t === 'string' && /^[0-9a-f-]{36}$/.test(value.id ?? '')) {
      return { t: value.t, id: value.id! };
    }
  } catch {
    // fall through
  }
  throw invalid('cursor', 'Invalid cursor');
}

/**
 * Ask AI tables, always through a scoped transaction: RLS limits conversations, messages and
 * drafts to the signed-in user, and drafts also to employees in scope.
 */
export class AiRepository {
  async createConversation(tx: Tx, userId: string, now: Date): Promise<string> {
    const [row] = await tx
      .insert(aiConversations)
      .values({ userId, createdAt: now, updatedAt: now })
      .returning({ id: aiConversations.id });
    return row!.id;
  }

  async getConversation(tx: Tx, id: string) {
    const [row] = await tx.select().from(aiConversations).where(eq(aiConversations.id, id));
    return row;
  }

  async touchConversation(tx: Tx, id: string, now: Date): Promise<void> {
    await tx.update(aiConversations).set({ updatedAt: now }).where(eq(aiConversations.id, id));
  }

  listMessages(tx: Tx, conversationId: string): Promise<AiMessageRow[]> {
    return tx
      .select()
      .from(aiMessages)
      .where(eq(aiMessages.conversationId, conversationId))
      .orderBy(asc(aiMessages.seq));
  }

  async appendMessage(tx: Tx, row: typeof aiMessages.$inferInsert): Promise<void> {
    await tx.insert(aiMessages).values(row);
  }

  /** Input + output tokens of one conversation. */
  async conversationTokens(tx: Tx, conversationId: string): Promise<number> {
    const [row] = await tx
      .select({
        total:
          sql<number>`coalesce(sum(coalesce(${aiMessages.inputTokens}, 0) + coalesce(${aiMessages.outputTokens}, 0)), 0)`.mapWith(
            Number,
          ),
      })
      .from(aiMessages)
      .where(eq(aiMessages.conversationId, conversationId));
    return row?.total ?? 0;
  }

  /** The user's tokens since a moment (their own conversations only, by RLS). */
  async tokensSince(tx: Tx, userId: string, since: Date): Promise<number> {
    const [row] = await tx
      .select({
        total:
          sql<number>`coalesce(sum(coalesce(${aiMessages.inputTokens}, 0) + coalesce(${aiMessages.outputTokens}, 0)), 0)`.mapWith(
            Number,
          ),
      })
      .from(aiMessages)
      .innerJoin(aiConversations, eq(aiConversations.id, aiMessages.conversationId))
      .where(and(eq(aiConversations.userId, userId), gte(aiMessages.createdAt, since)));
    return row?.total ?? 0;
  }

  /** Codes, titles and countries of in-scope employees whose name matches. Never names. */
  findCodesByName(tx: Tx, name: string) {
    const pattern = `%${likeEscape(name)}%`;
    return tx
      .select({
        employeeCode: employees.employeeCode,
        jobTitle: jobTitles.name,
        country: employees.countryCode,
        status: employees.status,
      })
      .from(employees)
      .innerJoin(jobTitles, eq(jobTitles.id, employees.jobTitleId))
      .where(ilike(sql`(${employees.firstName} || ' ' || ${employees.lastName})`, pattern))
      .orderBy(asc(employees.employeeCode))
      .limit(10);
  }

  async employeeByCode(tx: Tx, code: string) {
    const [row] = await tx.select().from(employees).where(eq(employees.employeeCode, code));
    return row;
  }

  async createDraft(tx: Tx, values: typeof aiSalaryDrafts.$inferInsert): Promise<AiDraftRow> {
    const [row] = await tx.insert(aiSalaryDrafts).values(values).returning();
    return row!;
  }

  draftsByIds(tx: Tx, ids: string[]) {
    if (ids.length === 0) return Promise.resolve([]);
    return tx
      .select({
        draft: aiSalaryDrafts,
        employeeCode: employees.employeeCode,
        firstName: employees.firstName,
        lastName: employees.lastName,
      })
      .from(aiSalaryDrafts)
      .innerJoin(employees, eq(employees.id, aiSalaryDrafts.employeeId))
      .where(inArray(aiSalaryDrafts.id, ids));
  }

  /** The draft, locked, if it is the user's and its employee is in scope (RLS). */
  async lockDraft(tx: Tx, id: string): Promise<AiDraftRow | undefined> {
    const [row] = await tx
      .select()
      .from(aiSalaryDrafts)
      .where(eq(aiSalaryDrafts.id, id))
      .for('update');
    return row;
  }

  async markDraftApplied(tx: Tx, id: string, at: Date): Promise<void> {
    await tx.update(aiSalaryDrafts).set({ appliedAt: at }).where(eq(aiSalaryDrafts.id, id));
  }

  async insertSqlRun(tx: Tx, row: AiSqlRunInsert): Promise<void> {
    await tx.insert(aiSqlRuns).values(row);
  }

  /** Newest first, keyset on `(created_at, id)`, like the audit log. RLS decides whose runs. */
  async listSqlRuns(
    tx: Tx,
    query: ListAiSqlRunsQuery,
  ): Promise<{ items: AiSqlRun[]; nextCursor: string | null }> {
    const conditions: SQL[] = [];
    if (query.userId) conditions.push(eq(aiSqlRuns.userId, query.userId));
    if (query.status) conditions.push(eq(aiSqlRuns.status, query.status));
    if (query.from) conditions.push(gte(aiSqlRuns.createdAt, sql`${query.from}::date`));
    if (query.to) conditions.push(lt(aiSqlRuns.createdAt, sql`${query.to}::date + 1`));
    if (query.cursor) {
      const cursor = decodeCursor(query.cursor);
      conditions.push(
        or(
          lt(aiSqlRuns.createdAt, sql`${cursor.t}::timestamptz`),
          and(eq(aiSqlRuns.createdAt, sql`${cursor.t}::timestamptz`), lt(aiSqlRuns.id, cursor.id)),
        )!,
      );
    }
    const rows = await tx
      .select({
        run: aiSqlRuns,
        cursorTime: sql<string>`${aiSqlRuns.createdAt}::text`,
        userName: users.name,
      })
      .from(aiSqlRuns)
      .innerJoin(users, eq(users.id, aiSqlRuns.userId))
      .where(and(...conditions))
      .orderBy(desc(aiSqlRuns.createdAt), desc(aiSqlRuns.id))
      .limit(query.limit + 1);
    const page = rows.slice(0, query.limit);
    const last = page.at(-1);
    return {
      items: page.map(({ run, userName }) => ({
        id: run.id,
        conversationId: run.conversationId,
        user: { id: run.userId, name: userName },
        messageSeq: run.messageSeq,
        toolCallId: run.toolCallId,
        sql: run.sqlText,
        countries: run.countries.map((c) => c.trim()),
        status: run.status,
        errorCode: run.errorCode,
        errorMessage: run.errorMessage,
        rowCount: run.rowCount,
        truncated: run.truncated,
        durationMs: run.durationMs,
        model: run.model,
        createdAt: run.createdAt.toISOString(),
      })),
      nextCursor:
        rows.length > query.limit && last
          ? encodeCursor({ t: last.cursorTime, id: last.run.id })
          : null,
    };
  }
}
