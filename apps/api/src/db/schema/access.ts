import { sql, type AnyColumn } from 'drizzle-orm';
import {
  boolean,
  char,
  check,
  foreignKey,
  index,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
  type AnyPgColumn,
} from 'drizzle-orm/pg-core';
import { countries } from './catalogue.js';
import { bytea, citext } from './types.js';

/** Roles, permissions, users and sign-in state (docs/auth.md, RBAC). No RLS on these tables. */

export const userStatus = pgEnum('user_status', ['invited', 'active', 'deactivated']);

const timestamps = {
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
};

export const roles = pgTable(
  'roles',
  {
    id: uuid().primaryKey().defaultRandom(),
    /** Stable slug used by seeds, tests and audit rows (`global_hr`). */
    key: text().notNull().unique(),
    name: text().notNull().unique(),
    description: text(),
    countryScope: text({ enum: ['all', 'assigned'] }).notNull(),
    isSystem: boolean().notNull().default(false),
    version: integer().notNull().default(1),
    createdBy: uuid().references((): AnyPgColumn => users.id),
    ...timestamps,
  },
  (t) => [
    check('roles_key_format', sql`${t.key} ~ '^[a-z][a-z0-9_]{1,39}$'`),
    check('roles_country_scope', sql`${t.countryScope} in ('all', 'assigned')`),
    check('roles_version', sql`${t.version} >= 1`),
  ],
);

/** The permission catalogue; its keys match `permissionKeys` in @acme/shared. */
export const permissions = pgTable('permissions', {
  key: text().primaryKey(),
  description: text().notNull(),
});

export const rolePermissions = pgTable(
  'role_permissions',
  {
    roleId: uuid()
      .notNull()
      .references(() => roles.id, { onDelete: 'cascade' }),
    permissionKey: text()
      .notNull()
      .references(() => permissions.key),
  },
  (t) => [primaryKey({ columns: [t.roleId, t.permissionKey] })],
);

export const users = pgTable(
  'users',
  {
    id: uuid().primaryKey().defaultRandom(),
    email: citext().notNull().unique(),
    name: text().notNull(),
    roleId: uuid()
      .notNull()
      .references(() => roles.id, { onDelete: 'restrict' }),
    status: userStatus().notNull().default('invited'),
    /** argon2id PHC string. */
    passwordHash: text(),
    failedSignIns: integer().notNull().default(0),
    lockedUntil: timestamp({ withTimezone: true }),
    lastSignInAt: timestamp({ withTimezone: true }),
    version: integer().notNull().default(1),
    createdBy: uuid(),
    ...timestamps,
    deactivatedAt: timestamp({ withTimezone: true }),
  },
  (t) => [
    foreignKey({ columns: [t.createdBy], foreignColumns: [t.id] }),
    check('users_failed_sign_ins', sql`${t.failedSignIns} >= 0`),
    check('users_version', sql`${t.version} >= 1`),
    check(
      'users_active_has_password',
      sql`${t.status} <> 'active' or ${t.passwordHash} is not null`,
    ),
    check(
      'users_deactivated_at',
      sql`(${t.status} = 'deactivated') = (${t.deactivatedAt} is not null)`,
    ),
  ],
);

/** Countries for users whose role is limited to assigned countries. */
export const userCountries = pgTable(
  'user_countries',
  {
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    countryCode: char({ length: 2 })
      .notNull()
      .references(() => countries.code),
  },
  (t) => [primaryKey({ columns: [t.userId, t.countryCode] })],
);

export const sessions = pgTable(
  'sessions',
  {
    /** SHA-256 of the cookie token. */
    id: bytea().primaryKey(),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    lastSeenAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp({ withTimezone: true }).notNull(),
    ip: text(),
    userAgent: text(),
  },
  (t) => [
    index('sessions_user').on(t.userId), // X1
    check('sessions_id_length', sql`octet_length(${t.id as AnyColumn}) = 32`),
    check('sessions_expiry', sql`${t.expiresAt} > ${t.createdAt}`),
  ],
);

export const invites = pgTable(
  'invites',
  {
    tokenHash: bytea().primaryKey(),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdBy: uuid()
      .notNull()
      .references(() => users.id),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp({ withTimezone: true }).notNull(),
    usedAt: timestamp({ withTimezone: true }),
  },
  (t) => [
    index('invites_open_by_user')
      .on(t.userId)
      .where(sql`${t.usedAt} is null`), // X3
    check('invites_token_length', sql`octet_length(${t.tokenHash as AnyColumn}) = 32`),
  ],
);
