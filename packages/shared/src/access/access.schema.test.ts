import { describe, expect, it } from 'vitest';
import {
  createRoleRequestSchema,
  meSchema,
  missingRequirements,
  permissionKeys,
  permissionRequires,
  updateRoleRequestSchema,
} from './access.schema.js';

describe('permission catalogue', () => {
  it('has the eleven permissions from docs/auth.md', () => {
    expect(permissionKeys).toHaveLength(11);
  });

  it('only requires permissions that are in the catalogue', () => {
    for (const requirements of Object.values(permissionRequires)) {
      for (const requirement of requirements) expect(permissionKeys).toContain(requirement);
    }
  });

  it('reports each requirement a role is missing', () => {
    expect(missingRequirements(['ai:ask', 'employees:read'])).toEqual([
      { permission: 'ai:ask', requires: 'insights:read' },
    ]);
    expect(missingRequirements(['employees:read', 'insights:read', 'ai:ask'])).toEqual([]);
  });
});

describe('meSchema', () => {
  it('accepts the signed-in user with role, permissions and resolved countries', () => {
    const me = {
      id: '0b8f4a2e-6c1d-4f7e-9a3b-2d5e8c1f4a60',
      email: 'riya.kapoor@acme.test',
      name: 'Riya Kapoor',
      role: {
        id: '6f1c1f3e-2a51-4c55-9d4e-3c3a8e0b7a10',
        key: 'global_hr',
        name: 'Global HR',
        countryScope: 'all',
      },
      permissions: ['employees:read', 'roles:manage'],
      countries: ['IN', 'GB'],
    };
    expect(meSchema.parse(me)).toEqual(me);
  });

  it('rejects a permission that is not in the catalogue', () => {
    const result = meSchema.shape.permissions.safeParse(['payroll:run']);
    expect(result.success).toBe(false);
  });
});

describe('role requests', () => {
  it('needs at least one permission to create a role', () => {
    const result = createRoleRequestSchema.safeParse({
      name: 'Finance viewer',
      countryScope: 'all',
      permissions: [],
    });
    expect(result.success).toBe(false);
  });

  it('does not let an update change the country scope', () => {
    const result = updateRoleRequestSchema.safeParse({ countryScope: 'all', version: 2 });
    expect(result.success).toBe(false);
  });
});
