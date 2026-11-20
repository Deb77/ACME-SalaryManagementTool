import { useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { describeError, fieldErrors } from '../../api/client';
import {
  createEmployee,
  getEmployee,
  getTitleComparison,
  updateEmployee,
} from '../../api/endpoints';
import { useResource } from '../../api/useResource';
import { ErrorState } from '../../components';
import { useSession } from '../../session/SessionContext';
import { employeePath } from '../Employees/Employees.utils';
import { EmployeeFormView, type RoleBenchmark } from './EmployeeFormView';
import { EmployeeFormSkeleton } from './EmployeeFormSkeleton';

/** Container for Add employee (`/employees/new`) and Edit details (`/employees/:id/edit`). */
export function EmployeeFormScreen() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { me, meta, can, country: countryInfo } = useSession();
  const existing = useResource(id ? `employee-${id}` : null, (signal) =>
    getEmployee(id ?? '', { signal }),
  );
  const [role, setRole] = useState<{ jobTitleId: string; country: string } | null>(null);
  const comparison = useResource(
    can('insights:read') && role ? `title-${role.jobTitleId}` : null,
    (signal) => getTitleComparison(role?.jobTitleId ?? '', { signal }),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<unknown>(null);

  if (id && existing.status === 'error') {
    return <ErrorState description={describeError(existing.error)} onRetry={existing.reload} />;
  }
  if (id && !existing.data) return <EmployeeFormSkeleton />;

  const row = role && comparison.data?.rows.find((r) => r.country === role.country);
  const benchmark: RoleBenchmark | null =
    role && row
      ? {
          jobTitle: meta.jobTitles.find((t) => t.id === role.jobTitleId)?.name ?? '',
          countryName: countryInfo(role.country)?.name ?? role.country,
          currency: row.currency,
          headcount: row.headcount,
          minMinor: row.minMinor,
          medianMinor: row.medianMinor,
          maxMinor: row.maxMinor,
        }
      : null;
  const formErrors = fieldErrors(error);

  return (
    <EmployeeFormView
      employee={existing.data}
      countries={meta.countries.filter((c) => me.countries.includes(c.code))}
      departments={meta.departments}
      jobTitles={meta.jobTitles}
      benchmark={benchmark}
      onRoleChange={(jobTitleId, country) => setRole({ jobTitleId, country })}
      saving={saving}
      error={error && Object.keys(formErrors).length === 0 ? describeError(error) : undefined}
      serverErrors={formErrors}
      cancelHref={id ? employeePath(id) : '/employees'}
      onSubmit={async (submit) => {
        setSaving(true);
        setError(null);
        try {
          const saved =
            submit.mode === 'create'
              ? await createEmployee(submit.body)
              : await updateEmployee(id ?? '', submit.body);
          navigate(employeePath(saved.id));
        } catch (caught) {
          setError(caught);
          setSaving(false);
        }
      }}
    />
  );
}
