import type { CreateSalaryChangeResponse, Employee, SalaryChangeDraft } from '@acme/shared';
import { useState } from 'react';
import { describeError, fieldErrors } from '../../api/client';
import { createSalaryChange, getEmployee } from '../../api/endpoints';
import { useResource } from '../../api/useResource';
import { Dialog, ErrorState, LoadingState } from '../../components';
import { useSession } from '../../session/SessionContext';
import { SalaryChangeDialog } from './SalaryChangeDialog';

export interface SalaryChangeDialogContainerProps {
  /** The employee, when the page already has them; otherwise they are loaded by `employeeId`. */
  employee?: Employee;
  employeeId: string;
  draft?: SalaryChangeDraft;
  onClose: () => void;
  onSaved: (response: CreateSalaryChangeResponse) => void;
}

/**
 * Container for the salary change dialog: loads the employee when needed (Ask AI drafts) and
 * posts `POST /api/employees/:id/salary-changes`. Render it only while the dialog is open.
 */
export function SalaryChangeDialogContainer({
  employee: given,
  employeeId,
  draft,
  onClose,
  onSaved,
}: SalaryChangeDialogContainerProps) {
  const { meta, countryName } = useSession();
  const loaded = useResource(given ? null : `employee-${employeeId}`, (signal) =>
    getEmployee(employeeId, { signal }),
  );
  const employee = given ?? loaded.data;
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<unknown>(null);

  if (!employee) {
    return (
      <Dialog open title="Record salary change" onClose={onClose}>
        {loaded.status === 'error' ? (
          <ErrorState description={describeError(loaded.error)} onRetry={loaded.reload} />
        ) : (
          <LoadingState label="Loading employee…" shape="lines" rows={5} minHeight={240} />
        )}
      </Dialog>
    );
  }

  return (
    <SalaryChangeDialog
      open
      onClose={onClose}
      employee={{
        name: `${employee.firstName} ${employee.lastName}`,
        employeeCode: employee.employeeCode,
        jobTitle: employee.jobTitle.name,
        countryName: countryName(employee.country),
        salary: employee.salary,
        version: employee.version,
      }}
      reasons={meta.salaryChangeReasons}
      draft={draft}
      saving={saving}
      error={
        error && Object.keys(fieldErrors(error)).length === 0 ? describeError(error) : undefined
      }
      serverErrors={fieldErrors(error)}
      onSubmit={async (body) => {
        setSaving(true);
        setError(null);
        try {
          onSaved(await createSalaryChange(employee.id, body));
        } catch (caught) {
          setError(caught);
        } finally {
          setSaving(false);
        }
      }}
    />
  );
}
