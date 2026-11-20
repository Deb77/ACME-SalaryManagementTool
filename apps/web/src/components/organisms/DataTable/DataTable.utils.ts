import type { TableQuery } from './DataTable';

/** Clicking a column cycles ascending → descending → unsorted. */
export function nextSort<F extends string>(
  current: TableQuery<F>['sort'],
  field: F,
): TableQuery<F>['sort'] {
  if (current?.field !== field) return { field, order: 'asc' };
  return current.order === 'asc' ? { field, order: 'desc' } : undefined;
}

/** The phone sort menu's value for a sort, e.g. `salary:desc`; empty for the default order. */
export function sortValue<F extends string>(sort: TableQuery<F>['sort']): string {
  return sort ? `${sort.field}:${sort.order}` : '';
}

export function parseSortValue<F extends string>(value: string): TableQuery<F>['sort'] {
  const [field, order] = value.split(':');
  if (!field || (order !== 'asc' && order !== 'desc')) return undefined;
  return { field: field as F, order };
}
