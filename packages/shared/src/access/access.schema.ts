import { z } from 'zod';
import { countryCodeSchema, timestampSchema, versionSchema } from '../core/common.schema.js';

/**
 * The permission catalogue (docs/auth.md, RBAC). Defined in code because route guards name
 * these keys; roles in the database can only combine them.
 */
export const permissionKeys = [
  'employees:read',
  'employees:write',
  'employees:terminate',
  'salary:change',
  'employees:export',
  'imports:run',
  'insights:read',
  'ai:ask',
  'audit:read',
  'users:manage',
  'roles:manage',
] as const;

export type Permission = (typeof permissionKeys)[number];

export const permissionSchema = z.enum(permissionKeys);

/** "Requires" column of the catalogue: a role holding the key must also hold these. */
export const permissionRequires: Readonly<Record<Permission, readonly Permission[]>> = {
  'employees:read': [],
  'employees:write': ['employees:read'],
  'employees:terminate': ['employees:read'],
  'salary:change': ['employees:read'],
  'employees:export': ['employees:read'],
  'imports:run': ['employees:write', 'salary:change'],
  'insights:read': [],
  'ai:ask': ['employees:read', 'insights:read'],
  'audit:read': [],
  'users:manage': [],
  'roles:manage': [],
};

/** Permissions in `granted` whose requirements are not also granted (a role save returns 400). */
export function missingRequirements(
  granted: readonly Permission[],
): { permission: Permission; requires: Permission }[] {
  const held = new Set(granted);
  return granted.flatMap((permission) =>
    permissionRequires[permission]
      .filter((requirement) => !held.has(requirement))
      .map((requires) => ({ permission, requires })),
  );
}

export const countryScopes = ['all', 'assigned'] as const;
export type CountryScope = (typeof countryScopes)[number];

export const roleRefSchema = z.object({ id: z.uuid(), key: z.string(), name: z.string() });
export type RoleRef = z.infer<typeof roleRefSchema>;

/** `GET /api/auth/me`: what the UI needs to hide actions the user cannot take. */
export const meSchema = z.object({
  id: z.uuid(),
  email: z.email(),
  name: z.string(),
  role: roleRefSchema.extend({ countryScope: z.enum(countryScopes) }),
  permissions: z.array(permissionSchema),
  /** Resolved countries: every country for an `all` role, the assigned ones otherwise. */
  countries: z.array(countryCodeSchema),
});

export type Me = z.infer<typeof meSchema>;

export const permissionInfoSchema = z.object({
  key: permissionSchema,
  description: z.string(),
  requires: z.array(permissionSchema),
});

export type PermissionInfo = z.infer<typeof permissionInfoSchema>;

export const permissionCatalogueSchema = z.object({ items: z.array(permissionInfoSchema) });

export const roleSchema = z.object({
  id: z.uuid(),
  key: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  countryScope: z.enum(countryScopes),
  isSystem: z.boolean(),
  permissions: z.array(permissionSchema),
  userCount: z.int().nonnegative(),
  version: versionSchema,
});

export type Role = z.infer<typeof roleSchema>;

export const rolesResponseSchema = z.object({ items: z.array(roleSchema) });

const roleNameSchema = z.string().trim().min(1).max(60);

export const createRoleRequestSchema = z.strictObject({
  name: roleNameSchema,
  description: z.string().trim().max(200).optional(),
  countryScope: z.enum(countryScopes),
  permissions: z.array(permissionSchema).min(1),
});

export type CreateRoleRequest = z.infer<typeof createRoleRequestSchema>;

/** `countryScope` cannot change after creation (escalation rule 5). */
export const updateRoleRequestSchema = z.strictObject({
  name: roleNameSchema.optional(),
  description: z.string().trim().max(200).optional(),
  permissions: z.array(permissionSchema).min(1).optional(),
  version: versionSchema,
});

export type UpdateRoleRequest = z.infer<typeof updateRoleRequestSchema>;

export const userStatuses = ['active', 'invited', 'deactivated'] as const;

export const userSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  email: z.email(),
  role: roleRefSchema,
  countries: z.array(countryCodeSchema),
  status: z.enum(userStatuses),
  lastSignInAt: timestampSchema.nullable(),
  version: versionSchema,
});

export type User = z.infer<typeof userSchema>;

export const usersResponseSchema = z.object({ items: z.array(userSchema) });

export const inviteUserRequestSchema = z.strictObject({
  name: z.string().trim().min(1).max(100),
  email: z.email(),
  roleId: z.uuid(),
  countries: z.array(countryCodeSchema),
});

export type InviteUserRequest = z.infer<typeof inviteUserRequestSchema>;

/** The invite URL is shown once to the inviting user and never stored in clear (decision #25). */
export const inviteUserResponseSchema = z.object({ user: userSchema, inviteUrl: z.url() });

export type InviteUserResponse = z.infer<typeof inviteUserResponseSchema>;

export const updateUserRequestSchema = z.strictObject({
  roleId: z.uuid().optional(),
  countries: z.array(countryCodeSchema).optional(),
  version: versionSchema,
});

export type UpdateUserRequest = z.infer<typeof updateUserRequestSchema>;
