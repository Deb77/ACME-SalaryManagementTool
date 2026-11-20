import type { Permission } from '@acme/shared';
import { describe, expect, it } from 'vitest';
import { activeKeyFor, homePathFor, navGroupsFor } from './navigation';

const canFor = (permissions: Permission[]) => (p: Permission) => permissions.includes(p);
const keys = (permissions: Permission[]) =>
  navGroupsFor(canFor(permissions)).flatMap((group) => group.items.map((item) => item.key));

describe('navigation', () => {
  it('shows only the areas the user may open', () => {
    expect(keys(['employees:read', 'insights:read'])).toEqual(['employees', 'insights']);
    expect(keys(['employees:read', 'insights:read', 'ai:ask', 'users:manage'])).toEqual([
      'employees',
      'insights',
      'ask',
      'access',
    ]);
    expect(keys(['roles:manage'])).toEqual(['access']);
  });

  it('drops empty groups and picks the first page as home', () => {
    expect(navGroupsFor(canFor(['ai:ask'])).map((g) => g.label)).toEqual(['Analyse']);
    expect(homePathFor(canFor(['ai:ask']))).toBe('/ask');
    expect(homePathFor(canFor([]))).toBeNull();
  });

  it('marks the area of nested pages', () => {
    expect(activeKeyFor('/employees/abc/edit')).toBe('employees');
    expect(activeKeyFor('/')).toBe('');
  });
});
