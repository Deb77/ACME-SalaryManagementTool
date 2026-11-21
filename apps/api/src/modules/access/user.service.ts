import type { InviteUserRequest, InviteUserResponse, UpdateUserRequest, User } from '@acme/shared';
import { assertCountryInScope, type Actor } from '../../auth/actor.js';
import { hashToken, newToken } from '../../auth/tokens.js';
import type { Db } from '../../db/database.js';
import type { ScopedDb, Tx } from '../../db/scope.js';
import type { Clock } from '../../lib/clock.js';
import { conflict, forbidden, invalid, notFound, staleVersion } from '../../lib/errors.js';
import { diff, type AuditService } from '../audit/audit.service.js';
import type { CatalogueService } from '../meta/catalogue.service.js';
import { assertHolds, type RoleService } from './role.service.js';
import type { UserRepository } from './user.repository.js';

const INVITE_MS = 72 * 60 * 60 * 1000;
const GLOBAL_HR = 'global_hr';

/**
 * HR users: invite, change role or countries, deactivate, reactivate, re-issue links
 * (docs/api.md, Access management). Every change writes an audit row.
 */
export class UserService {
  constructor(
    private readonly db: Db,
    private readonly scoped: ScopedDb,
    private readonly roles: RoleService,
    private readonly audit: AuditService,
    private readonly catalogue: CatalogueService,
    private readonly clock: Clock,
    private readonly appUrl: string,
    private readonly users: UserRepository,
  ) {}

  async list(): Promise<User[]> {
    return this.users.load(this.db);
  }

  async invite(actor: Actor, input: InviteUserRequest): Promise<InviteUserResponse> {
    return this.scoped.run(actor, async (tx) => {
      const role = await this.roles.one(tx, input.roleId);
      const countries = await this.checkAssignment(actor, role, input.countries);
      const userId = await this.users.insert(tx, {
        email: input.email.toLowerCase(),
        name: input.name,
        roleId: role.id,
        createdBy: actor.userId,
      });
      await this.users.setCountries(tx, userId, countries);
      const inviteUrl = await this.issueInvite(tx, actor, userId);
      await this.audit.record(tx, actor, {
        action: 'user.invited',
        entityType: 'user',
        entityId: userId,
        entityLabel: `${input.name} <${input.email.toLowerCase()}>`,
        after: { role: role.key, countries },
      });
      return { user: await this.one(tx, userId), inviteUrl };
    });
  }

  async update(actor: Actor, id: string, input: UpdateUserRequest): Promise<User> {
    if (id === actor.userId && input.roleId !== undefined) {
      throw conflict('You cannot change your own role; ask another admin');
    }
    return this.scoped.run(actor, async (tx) => {
      const before = await this.one(tx, id, true);
      if (before.version !== input.version) throw staleVersion();
      const role = await this.roles.one(tx, input.roleId ?? before.role.id);
      const roleChanged = role.id !== before.role.id;
      const countries =
        input.countries !== undefined || roleChanged
          ? await this.checkAssignment(actor, role, input.countries ?? before.countries)
          : before.countries;
      if (roleChanged && before.role.key === GLOBAL_HR && before.status === 'active') {
        await this.assertAnotherGlobalHr(tx, id);
      }

      const changes = diff(
        { role: before.role.key, countries: before.countries.join(',') },
        { role: role.key, countries: countries.join(',') },
      );
      if (!changes) return before;

      await this.users.update(tx, id, { roleId: role.id });
      await this.users.setCountries(tx, id, countries);
      await this.audit.record(tx, actor, {
        action: 'user.updated',
        entityType: 'user',
        entityId: id,
        entityLabel: `${before.name} <${before.email}>`,
        before: changes.before,
        after: changes.after,
      });
      return this.one(tx, id);
    });
  }

  async deactivate(actor: Actor, id: string): Promise<User> {
    if (id === actor.userId) throw conflict('You cannot deactivate yourself');
    return this.scoped.run(actor, async (tx) => {
      const before = await this.one(tx, id, true);
      if (before.status === 'deactivated') return before;
      if (before.role.key === GLOBAL_HR && before.status === 'active')
        await this.assertAnotherGlobalHr(tx, id);
      await this.users.update(tx, id, { status: 'deactivated', deactivatedAt: this.clock.now() });
      // Access ends now, not when the session expires.
      await this.users.endSessions(tx, id);
      await this.users.revokeInvites(tx, id);
      await this.audit.record(tx, actor, {
        action: 'user.deactivated',
        entityType: 'user',
        entityId: id,
        entityLabel: `${before.name} <${before.email}>`,
        before: { status: before.status },
        after: { status: 'deactivated' },
      });
      return this.one(tx, id);
    });
  }

  async reactivate(actor: Actor, id: string): Promise<User> {
    return this.scoped.run(actor, async (tx) => {
      const before = await this.one(tx, id, true);
      if (before.status !== 'deactivated') return before;
      // Without a password they go back to "invited" and need a new link.
      const status = (await this.users.hasPassword(tx, id)) ? 'active' : 'invited';
      await this.users.update(tx, id, {
        status,
        deactivatedAt: null,
        failedSignIns: 0,
        lockedUntil: null,
      });
      await this.audit.record(tx, actor, {
        action: 'user.updated',
        entityType: 'user',
        entityId: id,
        entityLabel: `${before.name} <${before.email}>`,
        before: { status: 'deactivated' },
        after: { status },
      });
      return this.one(tx, id);
    });
  }

  /** A new invite or password-reset link; earlier links and sessions stop working. */
  async reissueInvite(actor: Actor, id: string): Promise<InviteUserResponse> {
    return this.scoped.run(actor, async (tx) => {
      const user = await this.one(tx, id, true);
      if (user.status === 'deactivated')
        throw conflict('Reactivate this user before sending a new link');
      if (id === actor.userId) throw conflict('You cannot reset your own access here');
      await this.users.endSessions(tx, id);
      const inviteUrl = await this.issueInvite(tx, actor, id);
      await this.audit.record(tx, actor, {
        action: 'user.invited',
        entityType: 'user',
        entityId: id,
        entityLabel: `${user.name} <${user.email}>`,
        details: { reissued: true },
      });
      return { user, inviteUrl };
    });
  }

  private async issueInvite(tx: Tx, actor: Actor, userId: string): Promise<string> {
    await this.users.revokeInvites(tx, userId);
    const token = newToken();
    const now = this.clock.now();
    await this.users.insertInvite(tx, {
      tokenHash: hashToken(token),
      userId,
      createdBy: actor.userId,
      createdAt: now,
      expiresAt: new Date(now.getTime() + INVITE_MS),
    });
    // The token is in the fragment, so it never reaches server logs or Referer headers.
    return `${this.appUrl.replace(/\/$/, '')}/accept-invite#token=${token}`;
  }

  /** Escalation rules 1 and 2 plus the country rules for an assignment; returns the countries to store. */
  private async checkAssignment(
    actor: Actor,
    role: { key: string; countryScope: 'all' | 'assigned'; permissions: readonly string[] },
    requested: readonly string[],
  ): Promise<string[]> {
    assertHolds(actor, role.permissions as never);
    if (role.countryScope === 'all') {
      if (actor.role.countryScope !== 'all')
        throw forbidden('Only an all-countries user can assign an all-countries role');
      return [];
    }
    const catalogue = await this.catalogue.get();
    const countries = [...new Set(requested)].sort();
    if (countries.length === 0)
      throw invalid('countries', 'Choose at least one country for this role');
    for (const code of countries) {
      catalogue.assertKnown('country', code);
      assertCountryInScope(actor, code, 'countries');
    }
    return countries;
  }

  private async assertAnotherGlobalHr(tx: Tx, exceptId: string) {
    if ((await this.users.countActiveWithRole(tx, GLOBAL_HR, exceptId)) === 0)
      throw conflict('This is the last active Global HR user; someone must keep access');
  }

  private async one(tx: Db | Tx, id: string, lock = false): Promise<User> {
    if (lock) await this.users.lock(tx, id);
    const [user] = await this.users.load(tx, id);
    if (!user) throw notFound('User not found');
    return user;
  }
}
