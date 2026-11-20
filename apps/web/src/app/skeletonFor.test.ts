import { describe, expect, it } from 'vitest';
import { skeletonFor } from './skeletonFor';

describe('skeletonFor', () => {
  it.each([
    ['/employees', 'list'],
    ['/employees/new', 'form'],
    ['/employees/abc/edit', 'form'],
    ['/employees/import', 'form'],
    ['/employees/abc', 'detail'],
    ['/insights', 'dashboard'],
    ['/access', 'cards'],
    ['/ask', 'list'],
  ])('sketches %s as %s', (path, variant) => {
    expect(skeletonFor(path)).toBe(variant);
  });
});
