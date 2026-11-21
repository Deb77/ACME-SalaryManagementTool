import { and, asc, count, eq, inArray, sql } from 'drizzle-orm';
import { permissionKeys, type Permission, type Role } from '@acme/shared';
import type { Db } from '../../db/database.js';
import type { Tx } from '../../db/scope.js';
import { permissions, rolePermissions, roles, users } from '../../db/schema/index.js';

type NewRoleRow = typeof roles.$inferInsert;

/** Roles, their permissions and the permission catalogue. Auth tables have no RLS. */
export class RoleRepository {
  async permissions(db: Db | Tx) {
    return db.select().from(permissions);
  }

  async keyTaken(tx: Tx, key: string): Promise<boolean> {
    const [clash] = await tx.select({ id: roles.id }).from(roles).where(eq(roles.key, key));
    return clash !== undefined;
  }

  async insert(tx: Tx, values: NewRoleRow): Promise<string> {
    const [role] = await tx.insert(roles).values(values).returning({ id: roles.id });
    return role!.id;
  }

  /** Renames or redescribes a role and bumps its version. */
  async update(
    tx: Tx,
    id: string,
    patch: { name?: string; description?: string | null },
  ): Promise<void> {
    await tx
      .update(roles)
      .set({ ...patch, version: sql`${roles.version} + 1`, updatedAt: sql`now()` })
      .where(eq(roles.id, id));
  }

  /** Replaces the role's permissions with `granted`. */
  async setPermissions(tx: Tx, roleId: string, granted: readonly Permission[]): Promise<void> {
    await tx.delete(rolePermissions).where(eq(rolePermissions.roleId, roleId));
    if (granted.length > 0) {
      await tx
        .insert(rolePermissions)
        .values(granted.map((permissionKey) => ({ roleId, permissionKey })));
    }
  }

  async delete(tx: Tx, id: string): Promise<void> {
    await tx.delete(roles).where(eq(roles.id, id));
  }

  async lock(tx: Db | Tx, id: string): Promise<void> {
    await tx.select({ id: roles.id }).from(roles).where(eq(roles.id, id)).for('update');
  }

  /** Roles (one, or all) with their permissions in catalogue order and how many active holders. */
  async load(db: Db | Tx, id?: string): Promise<Role[]> {
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
