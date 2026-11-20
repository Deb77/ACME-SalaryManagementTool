import type { TableQuery } from './DataTable';

/** Clicking a column cycles ascending → descending → unsorted. */
export function nextSort<F extends string>(
  current: TableQuery<F>['sort'],
  field: F,
): TableQuery<F>['sort'] {
  if (current?.field !== field) return { field, order: 'asc' };
  return current.order === 'asc' ? { field, order: 'desc' } : undefined;
}
