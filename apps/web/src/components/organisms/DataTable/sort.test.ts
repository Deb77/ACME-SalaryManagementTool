import { describe, expect, it } from 'vitest';
import { nextSort } from './sort';

describe('nextSort', () => {
  it('cycles a column through ascending, descending and unsorted', () => {
    const asc = nextSort(undefined, 'name');
    const desc = nextSort(asc, 'name');

    expect(asc).toEqual({ field: 'name', order: 'asc' });
    expect(desc).toEqual({ field: 'name', order: 'desc' });
    expect(nextSort(desc, 'name')).toBeUndefined();
  });

  it('starts ascending when another column is chosen', () => {
    expect(nextSort({ field: 'name', order: 'desc' }, 'title')).toEqual({
      field: 'title',
      order: 'asc',
    });
  });
});
