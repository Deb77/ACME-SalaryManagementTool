import {
  permissionKeys,
  permissionRequires,
  type Me,
  type Permission,
  type Role,
  type User,
} from '@acme/shared';

/**
 * What the signed-in user may do, from `GET /api/auth/me`. The UI hides what the user cannot
 * do; the server checks every request anyway (docs/auth.md), so this is convenience only.
 */
export function can(me: Pick<Me, 'permissions'>, permission: Permission): boolean {
  return me.permissions.includes(permission);
}

export function canAny(me: Pick<Me, 'permissions'>, permissions: readonly Permission[]) {
  return permissions.some((permission) => can(me, permission));
}

/** Escalation rules 1 and 2: you hold every permission of the role, and an `all` scope only if you have one. */
export function canAssignRole(me: Me, role: Pick<Role, 'permissions' | 'countryScope'>): boolean {
  const holdsAll = role.permissions.every((permission) => can(me, permission));
  const scopeAllowed = role.countryScope !== 'all' || me.role.countryScope === 'all';
  return holdsAll && scopeAllowed;
}

/** Rule 4: someone must always be able to manage access. */
export function isLastActiveGlobalHr(user: User, users: readonly User[]): boolean {
  if (user.role.key !== 'global_hr' || user.status !== 'active') return false;
  return users.filter((u) => u.role.key === 'global_hr' && u.status === 'active').length === 1;
}

export interface AccessEditRules {
  /** Rule 3: nobody changes their own access. */
  isSelf: boolean;
  /** Rule 4: the last active Global HR keeps their role and access. */
  isLastGlobalHr: boolean;
  /** Rule 1: you cannot change the access of someone whose role you could not assign. */
  outranks: boolean;
}

export function accessEditRules(
  me: Me,
  user: User,
  users: readonly User[],
  roles: readonly Role[],
): AccessEditRules {
  const role = roles.find((r) => r.id === user.role.id);
  return {
    isSelf: user.id === me.id,
    isLastGlobalHr: isLastActiveGlobalHr(user, users),
    outranks: role !== undefined && !canAssignRole(me, role),
  };
}

export function canEditAccess(rules: AccessEditRules): boolean {
  return !rules.isSelf && !rules.outranks;
}

/** Rules 3 and 4 for roles: `global_hr` is fixed and you cannot edit the role you hold. */
export function canEditRole(me: Me, role: Role): boolean {
  return can(me, 'roles:manage') && role.key !== 'global_hr' && role.id !== me.role.id;
}

/** Rule 6: only a custom role that nobody holds can be deleted. */
export function canDeleteRole(me: Me, role: Role): boolean {
  return can(me, 'roles:manage') && !role.isSystem && role.userCount === 0;
}

/** Adds every permission the selection requires, transitively, in catalogue order. */
export function withRequirements(selection: readonly Permission[]): Permission[] {
  const result = new Set<Permission>();
  const add = (permission: Permission) => {
    if (result.has(permission)) return;
    result.add(permission);
    permissionRequires[permission].forEach(add);
  };
  selection.forEach(add);
  return permissionKeys.filter((key) => result.has(key));
}

/** Removes a permission and everything that depends on it, so the role stays valid. */
export function withoutPermission(
  selection: readonly Permission[],
  removed: Permission,
): Permission[] {
  const dropped = new Set<Permission>([removed]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const permission of selection) {
      if (!dropped.has(permission) && permissionRequires[permission].some((r) => dropped.has(r))) {
        dropped.add(permission);
        changed = true;
      }
    }
  }
  return selection.filter((permission) => !dropped.has(permission));
}
