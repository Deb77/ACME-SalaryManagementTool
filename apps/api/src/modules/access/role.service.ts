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
import { AppError, conflict, forbidden, notFound, staleVersion } from '../../lib/errors.js';
import { diff, type AuditService } from '../audit/audit.service.js';
import type { RoleRepository } from './role.repository.js';

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
    private readonly roles: RoleRepository,
  ) {}

  /** The server refuses to start when the permissions table and the code disagree. */
  async assertCatalogueMatchesCode(): Promise<void> {
    const rows = await this.roles.permissions(this.db);
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
    const rows = await this.roles.permissions(this.db);
    const description = new Map(rows.map((r) => [r.key, r.description]));
    return permissionKeys.map((key) => ({
      key,
      description: description.get(key) ?? key,
      requires: [...permissionRequires[key]],
    }));
  }

  async list(): Promise<Role[]> {
    return this.roles.load(this.db);
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
      if (await this.roles.keyTaken(tx, key))
        key = `${key.slice(0, 33)}_${Math.random().toString(36).slice(2, 7)}`;
      const id = await this.roles.insert(tx, {
        key,
        name: input.name,
        description: input.description || null,
        countryScope: input.countryScope,
        createdBy: actor.userId,
      });
      await this.roles.setPermissions(tx, id, granted);
      await this.audit.record(tx, actor, {
        action: 'role.created',
        entityType: 'role',
        entityId: id,
        entityLabel: input.name,
        after: { name: input.name, countryScope: input.countryScope, permissions: granted },
      });
      return this.one(tx, id);
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

      await this.roles.update(tx, id, {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.description !== undefined ? { description: input.description || null } : {}),
      });
      if (granted) await this.roles.setPermissions(tx, id, granted);
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
      await this.roles.delete(tx, id);
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
    if (lock) await this.roles.lock(tx, id);
    const [role] = await this.roles.load(tx, id);
    if (!role) throw notFound('Role not found');
    return role;
  }
}
