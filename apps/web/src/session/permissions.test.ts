import type { Me, Role, User } from '@acme/shared';
import { describe, expect, it } from 'vitest';
import {
  accessEditRules,
  can,
  canAssignRole,
  canDeleteRole,
  canEditAccess,
  canEditRole,
  isLastActiveGlobalHr,
  withoutPermission,
  withRequirements,
} from './permissions';

const ids = {
  me: '00000000-0000-4000-8000-000000000001',
  other: '00000000-0000-4000-8000-000000000002',
  globalRole: '00000000-0000-4000-8000-0000000000a1',
  countryRole: '00000000-0000-4000-8000-0000000000a2',
};

const countryHrMe: Me = {
  id: ids.me,
  email: 'ananya.rao@acme.test',
  name: 'Ananya Rao',
  role: { id: ids.countryRole, key: 'country_hr', name: 'Country HR', countryScope: 'assigned' },
  permissions: [
    'employees:read',
    'employees:write',
    'salary:change',
    'insights:read',
    'users:manage',
  ],
  countries: ['IN'],
};

const role = (overrides: Partial<Role>): Role => ({
  id: ids.countryRole,
  key: 'custom',
  name: 'Custom',
  description: null,
  countryScope: 'assigned',
  isSystem: false,
  permissions: ['employees:read'],
  userCount: 0,
  version: 1,
  ...overrides,
});

const user = (overrides: Partial<User>): User => ({
  id: ids.other,
  name: 'Daniel Brooks',
  email: 'daniel.brooks@acme.test',
  role: { id: ids.globalRole, key: 'global_hr', name: 'Global HR' },
  countries: [],
  status: 'active',
  lastSignInAt: null,
  version: 1,
  ...overrides,
});

describe('can', () => {
  it('checks the permission list from /auth/me', () => {
    expect(can(countryHrMe, 'salary:change')).toBe(true);
    expect(can(countryHrMe, 'roles:manage')).toBe(false);
  });
});

describe('canAssignRole', () => {
  it('only allows roles whose permissions you all hold', () => {
    expect(canAssignRole(countryHrMe, role({ permissions: ['employees:read'] }))).toBe(true);
    expect(canAssignRole(countryHrMe, role({ permissions: ['employees:export'] }))).toBe(false);
  });

  it('only lets an all-countries user assign an all-countries role', () => {
    expect(canAssignRole(countryHrMe, role({ countryScope: 'all' }))).toBe(false);
  });
});

describe('access edit rules', () => {
  it('stops you changing your own access', () => {
    const rules = accessEditRules(countryHrMe, user({ id: ids.me }), [], []);
    expect(canEditAccess(rules)).toBe(false);
  });

  it('stops you changing someone whose role you could not assign', () => {
    const globalRole = role({ id: ids.globalRole, key: 'global_hr', countryScope: 'all' });
    const rules = accessEditRules(countryHrMe, user({}), [user({})], [globalRole]);
    expect(rules.outranks).toBe(true);
  });

  it('knows the last active Global HR', () => {
    const daniel = user({});
    expect(isLastActiveGlobalHr(daniel, [daniel])).toBe(true);
    expect(isLastActiveGlobalHr(daniel, [daniel, user({ id: ids.me })])).toBe(false);
  });
});

describe('role rules', () => {
  const manager: Me = { ...countryHrMe, permissions: [...countryHrMe.permissions, 'roles:manage'] };

  it('never edits Global HR or the role you hold', () => {
    expect(canEditRole(manager, role({ key: 'global_hr', id: ids.globalRole }))).toBe(false);
    expect(canEditRole(manager, role({ id: ids.countryRole }))).toBe(false);
    expect(canEditRole(manager, role({ id: ids.other }))).toBe(true);
  });

  it('only deletes a custom role nobody holds', () => {
    expect(canDeleteRole(manager, role({ id: ids.other, userCount: 2 }))).toBe(false);
    expect(canDeleteRole(manager, role({ id: ids.other, isSystem: true }))).toBe(false);
    expect(canDeleteRole(manager, role({ id: ids.other }))).toBe(true);
  });
});

describe('permission dependencies', () => {
  it('adds requirements transitively', () => {
    expect(withRequirements(['imports:run'])).toEqual([
      'employees:read',
      'employees:write',
      'salary:change',
      'imports:run',
    ]);
  });

  it('removes dependants with the permission they need', () => {
    expect(
      withoutPermission(
        ['employees:read', 'insights:read', 'ai:ask', 'audit:read'],
        'insights:read',
      ),
    ).toEqual(['employees:read', 'audit:read']);
  });
});
