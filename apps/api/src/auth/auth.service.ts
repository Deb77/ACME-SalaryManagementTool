import { and, eq, isNull, lt, or, sql } from 'drizzle-orm';
import type { AcceptInviteRequest, CountryScope, InviteInfo, Permission } from '@acme/shared';
import type { Db } from '../db/database.js';
import type { Tx } from '../db/scope.js';
import { invites, sessions, users } from '../db/schema/index.js';
import type { Clock } from '../lib/clock.js';
import { AppError, notFound } from '../lib/errors.js';
import type { Actor } from './actor.js';
import type { PasswordHasher } from './password.js';
import { hashToken, newToken } from './tokens.js';

export const SESSION_IDLE_MS = 2 * 60 * 60 * 1000;
export const SESSION_ABSOLUTE_MS = 12 * 60 * 60 * 1000;
/** `last_seen_at` is written at most this often. */
const TOUCH_EVERY_MS = 5 * 60 * 1000;
const MAX_FAILED_SIGN_INS = 5;
const LOCK_MS = 15 * 60 * 1000;

export interface SessionStart {
  token: string;
  actor: Actor;
}

interface ClientInfo {
  ip?: string;
  userAgent?: string;
}

const invalidCredentials = () => new AppError('unauthenticated', 'Email or password is incorrect');

interface ActorRow extends Record<string, unknown> {
  session_id: Buffer;
  last_seen_at: Date | string;
  user_id: string;
  email: string;
  name: string;
  role_id: string;
  role_key: string;
  role_name: string;
  country_scope: CountryScope;
  permissions: Permission[] | null;
  countries: string[] | null;
}

/**
 * Sessions, sign-in and invite acceptance (docs/auth.md). Auth tables have no RLS, so this is
 * the one service that uses the unscoped pool.
 */
export class AuthService {
  /** Verified against for unknown emails, so timing does not reveal which emails exist. */
  private dummyHash: Promise<string> | undefined;

  constructor(
    private readonly db: Db,
    private readonly hasher: PasswordHasher,
    private readonly clock: Clock,
  ) {}

  /** Session, user, role, permissions and countries in one round trip. */
  actorForToken(token: string): Promise<Actor | undefined> {
    return this.loadActor(this.db, hashToken(token));
  }

  private async loadActor(db: Db | Tx, id: Buffer): Promise<Actor | undefined> {
    const now = this.clock.now();
    const idleCutoff = new Date(now.getTime() - SESSION_IDLE_MS);
    const { rows } = await db.execute<ActorRow>(sql`
      select s.id as session_id, s.last_seen_at, u.id as user_id, u.email::text as email, u.name,
             r.id as role_id, r.key as role_key, r.name as role_name, r.country_scope,
             (select array_agg(rp.permission_key order by rp.permission_key)
                from role_permissions rp where rp.role_id = r.id) as permissions,
             case when r.country_scope = 'all'
               then (select array_agg(c.code::text order by c.code) from countries c)
               else (select array_agg(uc.country_code::text order by uc.country_code)
                       from user_countries uc where uc.user_id = u.id)
             end as countries
        from sessions s
        join users u on u.id = s.user_id
        join roles r on r.id = u.role_id
       where s.id = ${id}
         and s.expires_at > ${now}
         and s.last_seen_at > ${idleCutoff}
         and u.status = 'active'`);
    const row = rows[0];
    if (!row) return undefined;

    if (now.getTime() - new Date(row.last_seen_at).getTime() > TOUCH_EVERY_MS) {
      await db.update(sessions).set({ lastSeenAt: now }).where(eq(sessions.id, id));
    }
    return {
      userId: row.user_id,
      email: row.email,
      name: row.name,
      role: {
        id: row.role_id,
        key: row.role_key,
        name: row.role_name,
        countryScope: row.country_scope,
      },
      permissions: new Set(row.permissions ?? []),
      countries: row.countries ?? [],
      sessionId: id,
    };
  }

  async signIn(email: string, password: string, client: ClientInfo): Promise<SessionStart> {
    const [user] = await this.db
      .select({
        id: users.id,
        status: users.status,
        passwordHash: users.passwordHash,
        lockedUntil: users.lockedUntil,
      })
      .from(users)
      .where(eq(users.email, email));

    if (!user?.passwordHash) {
      this.dummyHash ??= this.hasher.hash('not-a-real-password-just-for-timing');
      await this.hasher.verify(await this.dummyHash, password);
      throw invalidCredentials();
    }

    const now = this.clock.now();
    const ok = await this.hasher.verify(user.passwordHash, password);
    const locked = user.lockedUntil !== null && user.lockedUntil > now;

    if (!ok) {
      // Atomic increment; the fifth failure in a row locks the account for 15 minutes.
      await this.db
        .update(users)
        .set({
          failedSignIns: sql`${users.failedSignIns} + 1`,
          lockedUntil: sql`case when ${users.failedSignIns} + 1 >= ${MAX_FAILED_SIGN_INS}
                             then ${new Date(now.getTime() + LOCK_MS)}::timestamptz
                             else ${users.lockedUntil} end`,
        })
        .where(eq(users.id, user.id));
      throw invalidCredentials();
    }
    if (locked || user.status !== 'active') throw invalidCredentials();

    return this.db.transaction(async (tx) => {
      await tx
        .update(users)
        .set({ failedSignIns: 0, lockedUntil: null, lastSignInAt: now })
        .where(eq(users.id, user.id));
      // No cron on the free plan: expired sessions are swept on each successful sign-in.
      await tx
        .delete(sessions)
        .where(
          or(
            lt(sessions.expiresAt, now),
            lt(sessions.lastSeenAt, new Date(now.getTime() - SESSION_IDLE_MS)),
          ),
        );
      return this.startSession(tx, user.id, client);
    });
  }

  async signOut(sessionId: Buffer): Promise<void> {
    await this.db.delete(sessions).where(eq(sessions.id, sessionId));
  }

  async inviteInfo(token: string): Promise<InviteInfo> {
    const invite = await this.openInvite(this.db, token);
    return { email: invite.email, name: invite.name, isReset: invite.hadPassword };
  }

  /** Sets the password, activates the user, ends their other sessions and signs them in. */
  async acceptInvite(
    { token, password }: AcceptInviteRequest,
    client: ClientInfo,
  ): Promise<SessionStart> {
    const passwordHash = await this.hasher.hash(password);
    return this.db.transaction(async (tx) => {
      const invite = await this.openInvite(tx, token, true);
      const now = this.clock.now();
      await tx.update(invites).set({ usedAt: now }).where(eq(invites.tokenHash, invite.tokenHash));
      await tx
        .update(users)
        .set({
          passwordHash,
          status: 'active',
          deactivatedAt: null,
          failedSignIns: 0,
          lockedUntil: null,
          lastSignInAt: now,
          updatedAt: now,
          version: sql`${users.version} + 1`,
        })
        .where(eq(users.id, invite.userId));
      await tx.delete(sessions).where(eq(sessions.userId, invite.userId));
      return this.startSession(tx, invite.userId, client);
    });
  }

  private async openInvite(db: Db | Tx, token: string, lock = false) {
    const tokenHash = hashToken(token);
    const query = db
      .select({
        tokenHash: invites.tokenHash,
        userId: invites.userId,
        email: sql<string>`${users.email}::text`,
        name: users.name,
        status: users.status,
        hadPassword: sql<boolean>`${users.passwordHash} is not null`,
      })
      .from(invites)
      .innerJoin(users, eq(users.id, invites.userId))
      .where(
        and(
          eq(invites.tokenHash, tokenHash),
          isNull(invites.usedAt),
          sql`${invites.expiresAt} > ${this.clock.now()}`,
        ),
      );
    const [invite] = lock ? await query.for('update', { of: invites }) : await query;
    // Deactivated users cannot come back through an old link; Global HR reactivates first.
    if (!invite || invite.status === 'deactivated') {
      throw notFound('This link has expired or was already used. Ask Global HR for a new one.');
    }
    return invite;
  }

  private async startSession(tx: Tx, userId: string, client: ClientInfo): Promise<SessionStart> {
    const token = newToken();
    const id = hashToken(token);
    const now = this.clock.now();
    await tx.insert(sessions).values({
      id,
      userId,
      createdAt: now,
      lastSeenAt: now,
      expiresAt: new Date(now.getTime() + SESSION_ABSOLUTE_MS),
      ip: client.ip ?? null,
      userAgent: client.userAgent?.slice(0, 300) ?? null,
    });
    const actor = await this.loadActor(tx, id);
    if (!actor) throw new Error('Session was not readable right after creation');
    return { token, actor };
  }
}
