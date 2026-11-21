import { and, asc, count, eq, inArray, isNull, ne, sql } from 'drizzle-orm';
import type { User } from '@acme/shared';
import type { Db } from '../../db/database.js';
import type { Tx } from '../../db/scope.js';
import { invites, roles, sessions, userCountries, users } from '../../db/schema/index.js';

type UserPatch = Partial<
  Pick<
    typeof users.$inferInsert,
    'roleId' | 'status' | 'deactivatedAt' | 'failedSignIns' | 'lockedUntil'
  >
>;

/** The bootstrap account that owns seeded rows; never shown or managed in the UI. */
const HIDDEN_EMAIL_DOMAIN = '@acme.invalid';
const visible = sql`${users.email}::text not like ${'%' + HIDDEN_EMAIL_DOMAIN}`;

/** HR users, their countries, sessions and invite links. Auth tables have no RLS. */
export class UserRepository {
  async insert(
    tx: Tx,
    values: { email: string; name: string; roleId: string; createdBy: string },
  ): Promise<string> {
    const [user] = await tx
      .insert(users)
      .values({ ...values, status: 'invited' })
      .returning({ id: users.id });
    return user!.id;
  }

  /** Changes the user and bumps their version. */
  async update(tx: Tx, id: string, patch: UserPatch): Promise<void> {
    await tx
      .update(users)
      .set({ ...patch, version: sql`${users.version} + 1`, updatedAt: sql`now()` })
      .where(eq(users.id, id));
  }

  async setCountries(tx: Tx, userId: string, countries: readonly string[]): Promise<void> {
    await tx.delete(userCountries).where(eq(userCountries.userId, userId));
    if (countries.length > 0) {
      await tx
        .insert(userCountries)
        .values(countries.map((countryCode) => ({ userId, countryCode })));
    }
  }

  async hasPassword(tx: Tx, id: string): Promise<boolean> {
    const [row] = await tx.select({ hash: users.passwordHash }).from(users).where(eq(users.id, id));
    return Boolean(row?.hash);
  }

  async endSessions(tx: Tx, userId: string): Promise<void> {
    await tx.delete(sessions).where(eq(sessions.userId, userId));
  }

  /** Marks every unused invite link for the user as used, so none of them works any more. */
  async revokeInvites(tx: Tx, userId: string): Promise<void> {
    await tx
      .update(invites)
      .set({ usedAt: sql`now()` })
      .where(and(eq(invites.userId, userId), isNull(invites.usedAt)));
  }

  async insertInvite(tx: Tx, invite: typeof invites.$inferInsert): Promise<void> {
    await tx.insert(invites).values(invite);
  }

  /** Active, visible holders of the role with `roleKey`, other than `exceptId`. */
  async countActiveWithRole(tx: Tx, roleKey: string, exceptId: string): Promise<number> {
    const [row] = await tx
      .select({ n: count() })
      .from(users)
      .innerJoin(roles, eq(roles.id, users.roleId))
      .where(
        and(eq(roles.key, roleKey), eq(users.status, 'active'), ne(users.id, exceptId), visible),
      );
    return row?.n ?? 0;
  }

  async lock(db: Db | Tx, id: string): Promise<void> {
    await db.select({ id: users.id }).from(users).where(eq(users.id, id)).for('update');
  }

  /** Users (one, or every visible one) with their role and countries, by name. */
  async load(db: Db | Tx, id?: string): Promise<User[]> {
    const rows = await db
      .select({
        id: users.id,
        name: users.name,
        email: sql<string>`${users.email}::text`,
        status: users.status,
        lastSignInAt: users.lastSignInAt,
        version: users.version,
        roleId: roles.id,
        roleKey: roles.key,
        roleName: roles.name,
      })
      .from(users)
      .innerJoin(roles, eq(roles.id, users.roleId))
      .where(id ? eq(users.id, id) : visible)
      .orderBy(asc(users.name));
    if (rows.length === 0) return [];
    const assigned = await db
      .select()
      .from(userCountries)
      .where(
        inArray(
          userCountries.userId,
          rows.map((r) => r.id),
        ),
      )
      .orderBy(asc(userCountries.countryCode));
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      email: r.email,
      role: { id: r.roleId, key: r.roleKey, name: r.roleName },
      countries: assigned.filter((a) => a.userId === r.id).map((a) => a.countryCode),
      status: r.status,
      lastSignInAt: r.lastSignInAt?.toISOString() ?? null,
      version: r.version,
    }));
  }
}
