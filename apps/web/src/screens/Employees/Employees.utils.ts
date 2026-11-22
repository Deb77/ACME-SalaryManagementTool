export interface EmployeeFilters {
  country?: string;
  department?: string;
  jobTitle?: string;
  status: 'active' | 'terminated' | 'all';
}

export const employeePath = (id: string) => `/employees/${id}`;

/** No search and no filter at all, Status included: what Clear filters goes back to. */
export const CLEARED_FILTERS: EmployeeFilters = { status: 'all' };

/** True when there is anything for Clear filters to clear; Status counts, even on Active. */
export function hasActiveFilters(filters: EmployeeFilters, search: string): boolean {
  return (
    search.trim() !== '' ||
    filters.country !== undefined ||
    filters.department !== undefined ||
    filters.jobTitle !== undefined ||
    filters.status !== 'all'
  );
}

/** The word before "people" in the count: the opening view (only Active) reads "active". */
export function countNoun(filters: EmployeeFilters, search: string): string {
  if (!hasActiveFilters(filters, search)) return '';
  return hasActiveFilters({ ...filters, status: 'all' }, search) || filters.status !== 'active'
    ? 'matching'
    : 'active';
}
