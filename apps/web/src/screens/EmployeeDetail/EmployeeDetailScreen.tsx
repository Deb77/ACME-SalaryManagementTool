import type { Employee } from '@acme/shared';
import { useState } from 'react';
import { useParams } from 'react-router';
import { describeError } from '../../api/client';
import {
  getEmployee,
  getTitleComparison,
  listSalaryChanges,
  terminateEmployee,
} from '../../api/endpoints';
import { useResource } from '../../api/useResource';
import { ErrorState } from '../../components';
import { useSession } from '../../session/SessionContext';
import { SalaryChangeDialogContainer } from '../SalaryChange/SalaryChangeDialogContainer';
import { EmployeeDetailView, type PayBenchmark } from './EmployeeDetailView';
import { TerminateDialog } from './TerminateDialog';
import { EmployeeDetailSkeleton } from './EmployeeDetailSkeleton';

/** Container: loads the employee, their history and the pay benchmark; owns the dialogs. */
export function EmployeeDetailScreen() {
  const { id = '' } = useParams();
  const { meta, can, countryName } = useSession();
  const employee = useResource(`employee-${id}`, (signal) => getEmployee(id, { signal }));
  const history = useResource(`history-${id}`, (signal) => listSalaryChanges(id, { signal }));
  const jobTitleId = employee.data?.jobTitle.id;
  const comparison = useResource(
    can('insights:read') && jobTitleId ? `title-${jobTitleId}` : null,
    (signal) => getTitleComparison(jobTitleId ?? '', { signal }),
  );
  const [dialog, setDialog] = useState<'salary' | 'terminate' | null>(null);
  const [terminating, setTerminating] = useState(false);
  const [terminateError, setTerminateError] = useState<string>();
  const [shownFor, setShownFor] = useState<string>();

  if (employee.status === 'error') {
    return (
      <ErrorState
        title="Employee could not load"
        description={describeError(employee.error)}
        onRetry={employee.reload}
      />
    );
  }
  // The page appears once, with everything in place: the employee, their history and the
  // benchmark (which waits for the employee's job title) arrive at different times, and
  // swapping each in as it lands made the cards resize several times. Only the first load
  // waits; a retry or a later change updates the page in place.
  const settled = (status: string) => status === 'success' || status === 'error';
  const allLoaded =
    employee.data !== undefined &&
    settled(history.status) &&
    (comparison.status === 'idle' || settled(comparison.status));
  if (allLoaded && shownFor !== id) setShownFor(id);
  if (!employee.data || (shownFor !== id && !allLoaded)) return <EmployeeDetailSkeleton />;
  const current: Employee = employee.data;

  const row = comparison.data?.rows.find((r) => r.country === current.country);
  const benchmark: PayBenchmark | null = row
    ? {
        headcount: row.headcount,
        minMinor: row.minMinor,
        medianMinor: row.medianMinor,
        maxMinor: row.maxMinor,
      }
    : null;

  return (
    <>
      <EmployeeDetailView
        employee={current}
        countryName={countryName(current.country)}
        history={{
          status: history.status === 'idle' ? 'loading' : history.status,
          items: history.data?.items ?? [],
          error: history.error,
          onRetry: history.reload,
        }}
        benchmark={can('insights:read') ? benchmark : undefined}
        canChangeSalary={can('salary:change')}
        canEdit={can('employees:write')}
        canTerminate={can('employees:terminate')}
        onRecordSalaryChange={() => setDialog('salary')}
        onTerminate={() => {
          setTerminateError(undefined);
          setDialog('terminate');
        }}
      />
      {dialog === 'salary' && (
        <SalaryChangeDialogContainer
          employee={current}
          employeeId={current.id}
          onClose={() => setDialog(null)}
          onSaved={({ employee: updated, salaryChange }) => {
            employee.setData(updated);
            history.setData({ items: [salaryChange, ...(history.data?.items ?? [])] });
            setDialog(null);
          }}
        />
      )}
      {dialog === 'terminate' && (
        <TerminateDialog
          open
          name={`${current.firstName} ${current.lastName}`}
          version={current.version}
          reasons={meta.terminationReasons}
          saving={terminating}
          error={terminateError}
          onCancel={() => setDialog(null)}
          onConfirm={async (body) => {
            setTerminating(true);
            try {
              employee.setData(await terminateEmployee(current.id, body));
              setDialog(null);
            } catch (error) {
              setTerminateError(describeError(error));
            } finally {
              setTerminating(false);
            }
          }}
        />
      )}
    </>
  );
}
