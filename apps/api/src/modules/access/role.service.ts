import { and, asc, count, eq, inArray, sql } from 'drizzle-orm';
import {
  missingRequirements,
  permissionKeys,
  permissionRequires,
  type CreateRoleRequest,
  type Permission,
  type PermissionInfo,
  type Role,
  type UpdateRoleRequest,
} from '@acme/shared';
import type { Actor } from '../../auth/actor.js';
import type { Db } from '../../db/database.js';
import type { ScopedDb, Tx } from '../../db/scope.js';
import { permissions, rolePermissions, roles, users } from '../../db/schema/index.js';
import { AppError, conflict, forbidden, notFound, staleVersion } from '../../lib/errors.js';
import { diff, type AuditService } from '../audit/audit.service.js';

const GLOBAL_HR = 'global_hr';

/** Every permission in `wanted` must be held by the actor (escalation rule 1). */
export function assertHolds(actor: Actor, wanted: readonly Permission[]) {
  const missing = wanted.filter((p) => !actor.permissions.has(p));
  if (missing.length > 0) {
    throw forbidden(`You can only grant permissions you hold (missing ${missing.join(', ')})`, [
      { path: 'permissions', message: missing.join(', ') },
    ]);
  }
}

function assertRequirements(granted: readonly Permission[]) {
  const missing = missingRequirements(granted);
  if (missing.length > 0) {
    throw new AppError(
      'validation_error',
      'Some permissions need others',
      missing.map((m) => ({
        path: 'permissions',
        message: `${m.permission} requires ${m.requires}`,
      })),
    );
  }
}

/** A stable key from the display name: "Finance viewer" → `finance_viewer`. */
function keyFrom(name: string) {
  const base = name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  const key = /^[a-z]/.test(base) ? base : `role_${base}`;
  return key.slice(0, 40).replace(/_+$/, '') || 'role';
}

/**
 * Roles and the permission catalogue (docs/auth.md, RBAC). Auth tables have no RLS; the
 * permission checks here are the escalation rules.
 */
export class RoleService {
  constructor(
    private readonly db: Db,
    private readonly scoped: ScopedDb,
    private readonly audit: AuditService,
  ) {}

  /** The server refuses to start when the permissions table and the code disagree. */
  async assertCatalogueMatchesCode(): Promise<void> {
    const rows = await this.db.select({ key: permissions.key }).from(permissions);
    const inDb = new Set(rows.map((r) => r.key));
    const inCode = new Set<string>(permissionKeys);
    const missing = [...inCode].filter((k) => !inDb.has(k));
    const extra = [...inDb].filter((k) => !inCode.has(k));
    if (missing.length > 0 || extra.length > 0) {
      throw new Error(
        `The permissions table does not match the code (missing: ${missing.join(', ') || 'none'}; unknown: ${extra.join(', ') || 'none'}). Run "npm run db:migrate".`,
      );
    }
  }

  async catalogue(): Promise<PermissionInfo[]> {
    const rows = await this.db.select().from(permissions);
    const description = new Map(rows.map((r) => [r.key, r.description]));
    return permissionKeys.map((key) => ({
      key,
      description: description.get(key) ?? key,
      requires: [...permissionRequires[key]],
    }));
  }

  async list(): Promise<Role[]> {
    return this.loadRoles(this.db);
  }

  async create(actor: Actor, input: CreateRoleRequest): Promise<Role> {
    const granted = [...new Set(input.permissions)];
    assertRequirements(granted);
    assertHolds(actor, granted);
    if (input.countryScope === 'all' && actor.role.countryScope !== 'all') {
      throw forbidden('Only an all-countries role can create another all-countries role');
    }
    return this.scoped.run(actor, async (tx) => {
      let key = keyFrom(input.name);
      const [clash] = await tx.select({ id: roles.id }).from(roles).where(eq(roles.key, key));
      if (clash) key = `${key.slice(0, 33)}_${Math.random().toString(36).slice(2, 7)}`;
      const [role] = await tx
        .insert(roles)
        .values({
          key,
          name: input.name,
          description: input.description || null,
          countryScope: input.countryScope,
          createdBy: actor.userId,
        })
        .returning();
      await tx
        .insert(rolePermissions)
        .values(granted.map((permissionKey) => ({ roleId: role!.id, permissionKey })));
      await this.audit.record(tx, actor, {
        action: 'role.created',
        entityType: 'role',
        entityId: role!.id,
        entityLabel: role!.name,
        after: { name: role!.name, countryScope: role!.countryScope, permissions: granted },
      });
      return this.one(tx, role!.id);
    });
  }

  async update(actor: Actor, id: string, input: UpdateRoleRequest): Promise<Role> {
    return this.scoped.run(actor, async (tx) => {
      const before = await this.one(tx, id, true);
      if (before.version !== input.version) throw staleVersion();
      if (before.key === GLOBAL_HR)
        throw conflict('Global HR always has every permission and cannot be edited');
      if (actor.role.id === id)
        throw forbidden('You cannot edit the role you hold; ask another admin');

      const granted = input.permissions ? [...new Set(input.permissions)] : undefined;
      if (granted) {
        assertRequirements(granted);
        // Adding needs the permission; removing one you do not hold is also an escalation path.
        const touched = [
          ...granted.filter((p) => !before.permissions.includes(p)),
          ...before.permissions.filter((p) => !granted.includes(p)),
        ];
        assertHolds(actor, touched);
      }

      const changes = diff(
        {
          name: before.name,
          description: before.description,
          permissions: before.permissions.join(','),
        },
        {
          name: input.name,
          description: input.description === undefined ? undefined : input.description || null,
          permissions: granted?.slice().sort().join(','),
        },
      );
      if (!changes) return before;

      await tx
        .update(roles)
        .set({
          ...(input.name !== undefined ? { name: input.name } : {}),
          ...(input.description !== undefined ? { description: input.description || null } : {}),
          version: sql`${roles.version} + 1`,
          updatedAt: sql`now()`,
        })
        .where(eq(roles.id, id));
      if (granted) {
        await tx.delete(rolePermissions).where(eq(rolePermissions.roleId, id));
        await tx
          .insert(rolePermissions)
          .values(granted.map((permissionKey) => ({ roleId: id, permissionKey })));
      }
      await this.audit.record(tx, actor, {
        action: 'role.updated',
        entityType: 'role',
        entityId: id,
        entityLabel: input.name ?? before.name,
        before: changes.before,
        after: changes.after,
      });
      return this.one(tx, id);
    });
  }

  async remove(actor: Actor, id: string): Promise<void> {
    await this.scoped.run(actor, async (tx) => {
      const role = await this.one(tx, id, true);
      if (role.isSystem) throw conflict('System roles cannot be deleted');
      if (role.userCount > 0) throw conflict('Move this role’s users to another role first');
      assertHolds(actor, role.permissions);
      await tx.delete(roles).where(eq(roles.id, id));
      await this.audit.record(tx, actor, {
        action: 'role.deleted',
        entityType: 'role',
        entityId: id,
        entityLabel: role.name,
        before: { name: role.name, countryScope: role.countryScope, permissions: role.permissions },
      });
    });
  }

  /** One role with permissions and holder count; 404 when it does not exist. */
  async one(tx: Db | Tx, id: string, lock = false): Promise<Role> {
    if (lock) await tx.select({ id: roles.id }).from(roles).where(eq(roles.id, id)).for('update');
    const [role] = await this.loadRoles(tx, id);
    if (!role) throw notFound('Role not found');
    return role;
  }

  private async loadRoles(db: Db | Tx, id?: string): Promise<Role[]> {
    const rows = await db
      .select()
      .from(roles)
      .where(id ? eq(roles.id, id) : undefined)
      .orderBy(asc(roles.isSystem), asc(roles.name));
    if (rows.length === 0) return [];
    const ids = rows.map((r) => r.id);
    const [grants, holders] = await Promise.all([
      db.select().from(rolePermissions).where(inArray(rolePermissions.roleId, ids)),
      db
        .select({ roleId: users.roleId, n: count() })
        .from(users)
        .where(and(inArray(users.roleId, ids), sql`${users.status} <> 'deactivated'`))
        .groupBy(users.roleId),
    ]);
    const order = new Map(permissionKeys.map((k, i) => [k, i]));
    return rows
      .sort((a, b) => Number(b.isSystem) - Number(a.isSystem) || a.name.localeCompare(b.name))
      .map((r) => ({
        id: r.id,
        key: r.key,
        name: r.name,
        description: r.description,
        countryScope: r.countryScope,
        isSystem: r.isSystem,
        permissions: grants
          .filter((g) => g.roleId === r.id)
          .map((g) => g.permissionKey as Permission)
          .sort((a, b) => (order.get(a) ?? 0) - (order.get(b) ?? 0)),
        userCount: holders.find((h) => h.roleId === r.id)?.n ?? 0,
        version: r.version,
      }));
  }
}
