import { sql } from 'drizzle-orm';
import {
  bigint,
  boolean,
  char,
  check,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { users } from './access.js';
import { employees } from './employees.js';

/**
 * Ask AI (docs/database.md, `ai_conversations`, `ai_messages`, `ai_salary_drafts`; decisions
 * #36-#40). Row-level security limits every row to the conversation's owner; the policies and
 * the `acme_ai_reader` role are hand-written in migration 0007.
 */

export const aiConversations = pgTable(
  'ai_conversations',
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: uuid()
      .notNull()
      .references(() => users.id),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // The daily token budget sums one user's conversations from today.
    index('ai_conversations_user_updated').on(t.userId, t.updatedAt.desc().nullsFirst()),
  ],
);

export const aiMessageRoles = ['user', 'assistant', 'tool'] as const;

/** One model turn or tool round, stored as the model loop sends it back on the next request. */
export const aiMessages = pgTable(
  'ai_messages',
  {
    conversationId: uuid()
      .notNull()
      .references(() => aiConversations.id, { onDelete: 'cascade' }),
    seq: integer().notNull(),
    role: text({ enum: aiMessageRoles }).notNull(),
    /** Content blocks (text, tool_use, tool_result, thinking) exactly as the API returned them. */
    content: jsonb().notNull(),
    /** Prompt tokens of the call that produced an assistant message, cache reads included. */
    inputTokens: integer(),
    outputTokens: integer(),
    /** Model that produced an assistant message (primary or fallback). */
    model: text(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.conversationId, t.seq] }),
    check('ai_messages_role', sql`${t.role} in ('user', 'assistant', 'tool')`),
    check('ai_messages_seq', sql`${t.seq} >= 0`),
    check('ai_messages_tokens', sql`${t.inputTokens} >= 0 and ${t.outputTokens} >= 0`),
  ],
);

/** A salary change proposed by Ask AI. Applied only through the normal salary change endpoint. */
export const aiSalaryDrafts = pgTable(
  'ai_salary_drafts',
  {
    id: uuid().primaryKey().defaultRandom(),
    conversationId: uuid()
      .notNull()
      .references(() => aiConversations.id),
    /** Cascade: import undo may delete an imported employee that only has unapplied drafts. */
    employeeId: uuid()
      .notNull()
      .references(() => employees.id, { onDelete: 'cascade' }),
    /** The employee's `version` when drafted; any later change to the employee makes it stale. */
    versionAtDraft: integer().notNull(),
    currentAmountMinor: bigint({ mode: 'number' }).notNull(),
    proposedAmountMinor: bigint({ mode: 'number' }).notNull(),
    currency: char({ length: 3 }).notNull(),
    effectiveDate: date({ mode: 'string' }).notNull(),
    reason: text({
      enum: ['annual_review', 'promotion', 'market_adjustment', 'correction', 'other'],
    }).notNull(),
    note: text(),
    createdAt: timestamp({ withTimezone: true }).notNull(),
    expiresAt: timestamp({ withTimezone: true }).notNull(),
    appliedAt: timestamp({ withTimezone: true }),
  },
  (t) => [
    index('ai_salary_drafts_conversation').on(t.conversationId),
    check('ai_salary_drafts_proposed_positive', sql`${t.proposedAmountMinor} > 0`),
    check(
      'ai_salary_drafts_reason',
      sql`${t.reason} in ('annual_review', 'promotion', 'market_adjustment', 'correction', 'other')`,
    ),
    check('ai_salary_drafts_note_length', sql`char_length(${t.note}) <= 500`),
    check('ai_salary_drafts_expiry', sql`${t.expiresAt} > ${t.createdAt}`),
  ],
);

export const aiSqlRunStatuses = ['ok', 'rejected', 'error', 'timeout'] as const;

/**
 * Every `run_sql` attempt, including SQL the validator rejected before it reached the database
 * (decision #41). Append-only for acme_app; written in its own transaction so it survives the
 * AI query's rollback. Never stores result rows.
 */
export const aiSqlRuns = pgTable(
  'ai_sql_runs',
  {
    id: uuid().primaryKey().defaultRandom(),
    conversationId: uuid()
      .notNull()
      .references(() => aiConversations.id),
    userId: uuid()
      .notNull()
      .references(() => users.id),
    /** The `seq` of the assistant message that asked for the call, and its tool_use id. */
    messageSeq: integer().notNull(),
    toolCallId: text().notNull(),
    /** The SQL exactly as the model wrote it (what was executed, before the row-cap wrapper). */
    sqlText: text().notNull(),
    /** The session's countries, as written to app_private.ai_scope. */
    countries: char({ length: 2 }).array().notNull(),
    status: text({ enum: aiSqlRunStatuses }).notNull(),
    errorCode: text(),
    errorMessage: text(),
    rowCount: integer(),
    truncated: boolean().notNull().default(false),
    durationMs: integer().notNull(),
    model: text().notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('ai_sql_runs_created').on(t.createdAt.desc().nullsFirst(), t.id.desc().nullsFirst()),
    index('ai_sql_runs_user_created').on(
      t.userId,
      t.createdAt.desc().nullsFirst(),
      t.id.desc().nullsFirst(),
    ),
    check('ai_sql_runs_status', sql`${t.status} in ('ok', 'rejected', 'error', 'timeout')`),
    check('ai_sql_runs_sql_length', sql`char_length(${t.sqlText}) <= 20000`),
    check('ai_sql_runs_error_length', sql`char_length(${t.errorMessage}) <= 500`),
    check('ai_sql_runs_counts', sql`${t.rowCount} >= 0 and ${t.durationMs} >= 0`),
  ],
);
