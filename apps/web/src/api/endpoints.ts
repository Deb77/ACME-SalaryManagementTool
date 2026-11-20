/**
 * Typed client for the HTTP API in docs/api.md. Every response is parsed with the shared
 * Zod schema from `@acme/shared`, so a contract change fails loudly instead of rendering
 * wrong data.
 */
import {
  auditEventSchema,
  createSalaryChangeResponseSchema,
  cursorPageSchema,
  employeeSchema,
  importRowSchema,
  importSchema,
  importUploadResponseSchema,
  insightsByTitleSchema,
  insightsOverviewSchema,
  inviteUserResponseSchema,
  meSchema,
  metaSchema,
  pageSchema,
  permissionCatalogueSchema,
  roleSchema,
  rolesResponseSchema,
  salaryDistributionSchema,
  salaryHistoryResponseSchema,
  titleComparisonSchema,
  userSchema,
  usersResponseSchema,
  type CommitImportRequest,
  type CreateEmployeeRequest,
  type CreateRoleRequest,
  type CreateSalaryChangeRequest,
  type ImportMappingRequest,
  type ImportOutcome,
  type InviteUserRequest,
  type TerminateEmployeeRequest,
  type UpdateEmployeeRequest,
  type UpdateRoleRequest,
  type UpdateUserRequest,
} from '@acme/shared';
import { API_BASE, buildQuery, request } from './client';

type Signal = { signal?: AbortSignal };

// ---- Session and catalogue ----

export const getMe = ({ signal }: Signal = {}) => request('/auth/me', meSchema, { signal });

export const getMeta = ({ signal }: Signal = {}) => request('/meta', metaSchema, { signal });

// ---- Employees ----

export type EmployeeSortField =
  'name' | 'employeeCode' | 'country' | 'jobTitle' | 'department' | 'hireDate' | 'salary';

export interface EmployeeListParams {
  q?: string;
  country?: readonly string[];
  department?: readonly string[];
  jobTitle?: readonly string[];
  status?: 'active' | 'terminated' | 'all';
  sort?: { field: EmployeeSortField; order: 'asc' | 'desc' };
  page: number;
  pageSize: number;
}

export function employeeListQuery({
  sort,
  ...params
}: Omit<EmployeeListParams, 'page' | 'pageSize'> & Partial<EmployeeListParams>) {
  return buildQuery({
    ...params,
    sort: sort ? `${sort.order === 'desc' ? '-' : ''}${sort.field}` : undefined,
  });
}

const employeePageSchema = pageSchema(employeeSchema);

export const listEmployees = (params: EmployeeListParams, { signal }: Signal = {}) =>
  request(`/employees${employeeListQuery(params)}`, employeePageSchema, { signal });

/** The CSV export is a plain download link with the list's filters (no paging). */
export function employeeExportUrl(params: Omit<EmployeeListParams, 'page' | 'pageSize'>) {
  return `${API_BASE}/employees/export.csv${employeeListQuery(params)}`;
}

export const getEmployee = (id: string, { signal }: Signal = {}) =>
  request(`/employees/${encodeURIComponent(id)}`, employeeSchema, { signal });

export const createEmployee = (body: CreateEmployeeRequest) =>
  request('/employees', employeeSchema, { method: 'POST', body });

export const updateEmployee = (id: string, body: UpdateEmployeeRequest) =>
  request(`/employees/${encodeURIComponent(id)}`, employeeSchema, { method: 'PATCH', body });

export const terminateEmployee = (id: string, body: TerminateEmployeeRequest) =>
  request(`/employees/${encodeURIComponent(id)}/terminate`, employeeSchema, {
    method: 'POST',
    body,
  });

export const listSalaryChanges = (id: string, { signal }: Signal = {}) =>
  request(`/employees/${encodeURIComponent(id)}/salary-changes`, salaryHistoryResponseSchema, {
    signal,
  });

export const createSalaryChange = (id: string, body: CreateSalaryChangeRequest) =>
  request(`/employees/${encodeURIComponent(id)}/salary-changes`, createSalaryChangeResponseSchema, {
    method: 'POST',
    body,
  });

// ---- Insights ----

export const getInsightsOverview = ({ signal }: Signal = {}) =>
  request('/insights/overview', insightsOverviewSchema, { signal });

export const getInsightsByTitle = (country: string, { signal }: Signal = {}) =>
  request(`/insights/by-title${buildQuery({ country })}`, insightsByTitleSchema, { signal });

export const getTitleComparison = (jobTitleId: string, { signal }: Signal = {}) =>
  request(`/insights/titles/${encodeURIComponent(jobTitleId)}`, titleComparisonSchema, { signal });

export const getSalaryDistribution = (country: string, { signal }: Signal = {}) =>
  request(
    `/insights/distribution${buildQuery({ country, buckets: 9 })}`,
    salaryDistributionSchema,
    { signal },
  );

// ---- Import ----

export const IMPORT_TEMPLATE_URL = `${API_BASE}/imports/template.xlsx`;

export function uploadImport(file: File) {
  const body = new FormData();
  body.append('file', file);
  return request('/imports', importUploadResponseSchema, { method: 'POST', body });
}

export const setImportMapping = (id: string, body: ImportMappingRequest) =>
  request(`/imports/${encodeURIComponent(id)}/mapping`, importSchema, { method: 'PUT', body });

const importRowPageSchema = pageSchema(importRowSchema);

export const listImportRows = (
  id: string,
  outcome: ImportOutcome,
  page: number,
  { signal }: Signal = {},
) =>
  request(
    `/imports/${encodeURIComponent(id)}/rows${buildQuery({ outcome, page, pageSize: 25 })}`,
    importRowPageSchema,
    { signal },
  );

export const importErrorReportUrl = (id: string) =>
  `${API_BASE}/imports/${encodeURIComponent(id)}/rows.csv?outcome=error`;

export const commitImport = (id: string, body: CommitImportRequest) =>
  request(`/imports/${encodeURIComponent(id)}/commit`, importSchema, { method: 'POST', body });

export const undoImport = (id: string) =>
  request(`/imports/${encodeURIComponent(id)}/undo`, importSchema, { method: 'POST' });

// ---- Access management ----

export const listUsers = ({ signal }: Signal = {}) =>
  request('/users', usersResponseSchema, { signal });

export const inviteUser = (body: InviteUserRequest) =>
  request('/users', inviteUserResponseSchema, { method: 'POST', body });

export const updateUser = (id: string, body: UpdateUserRequest) =>
  request(`/users/${encodeURIComponent(id)}`, userSchema, { method: 'PATCH', body });

export const deactivateUser = (id: string) =>
  request(`/users/${encodeURIComponent(id)}/deactivate`, userSchema, { method: 'POST' });

export const listRoles = ({ signal }: Signal = {}) =>
  request('/roles', rolesResponseSchema, { signal });

export const listPermissions = ({ signal }: Signal = {}) =>
  request('/permissions', permissionCatalogueSchema, { signal });

export const createRole = (body: CreateRoleRequest) =>
  request('/roles', roleSchema, { method: 'POST', body });

export const updateRole = (id: string, body: UpdateRoleRequest) =>
  request(`/roles/${encodeURIComponent(id)}`, roleSchema, { method: 'PATCH', body });

export const deleteRole = (id: string) =>
  request(`/roles/${encodeURIComponent(id)}`, null, { method: 'DELETE' });

const auditPageSchema = cursorPageSchema(auditEventSchema);

export const listAccessChanges = ({ signal }: Signal = {}) =>
  request(`/audit-events${buildQuery({ entityType: 'user', limit: 5 })}`, auditPageSchema, {
    signal,
  });
