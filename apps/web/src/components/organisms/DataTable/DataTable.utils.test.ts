import { describe, expect, it } from 'vitest';
import { nextSort, parseSortValue, sortValue } from './DataTable.utils';

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

describe('sortValue and parseSortValue', () => {
  it('round-trips a sort through the phone sort menu value', () => {
    expect(sortValue({ field: 'salary', order: 'desc' })).toBe('salary:desc');
    expect(parseSortValue('salary:desc')).toEqual({ field: 'salary', order: 'desc' });
  });

  it('treats an empty or malformed value as the default order', () => {
    expect(sortValue(undefined)).toBe('');
    expect(parseSortValue('')).toBeUndefined();
    expect(parseSortValue('salary:sideways')).toBeUndefined();
  });
});
