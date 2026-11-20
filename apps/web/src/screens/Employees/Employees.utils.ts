export interface EmployeeFilters {
  country?: string;
  department?: string;
  jobTitle?: string;
  status: 'active' | 'terminated' | 'all';
}

export const employeePath = (id: string) => `/employees/${id}`;

export function hasActiveFilters(filters: EmployeeFilters, search: string): boolean {
  return (
    search.trim() !== '' ||
    filters.country !== undefined ||
    filters.department !== undefined ||
    filters.jobTitle !== undefined ||
    filters.status !== 'active'
  );
}
