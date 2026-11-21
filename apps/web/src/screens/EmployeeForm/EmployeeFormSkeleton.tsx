import { useParams } from 'react-router';
import {
  FormField,
  PageHeader,
  PageSkeleton,
  PillButton,
  Skeleton,
  TrayCard,
} from '../../components';
import form from '../shared/form.module.css';
import styles from './EmployeeForm.module.css';

/**
 * A real labelled control, disabled and empty until the form arrives: only the values appear
 * then, so the form itself never changes. Selects keep their arrow, like the real ones.
 */
function Field({
  label,
  hint,
  kind = 'text',
}: {
  label: string;
  hint?: string;
  kind?: 'text' | 'select';
}) {
  return (
    <FormField label={label} required hint={hint}>
      {(control) =>
        kind === 'select' ? (
          <select {...control} className={form.control} disabled value="">
            <option value="" />
          </select>
        ) : (
          <input {...control} className={form.control} disabled value="" readOnly />
        )
      }
    </FormField>
  );
}

export interface EmployeeFormSkeletonProps {
  /** Add employee (`/employees/new`) or Edit details; defaults to edit when the URL has an id. */
  mode?: 'add' | 'edit';
  /**
   * Add only: the user sees one country, so the form starts with it chosen and the salary field
   * has no "Choose the country first" hint.
   */
  oneCountry?: boolean;
}

/**
 * EmployeeFormView while its code or the employee loads. Titles, labels, hints, card footers
 * and buttons are the real ones for each mode, so nothing moves when the form replaces it;
 * the controls are disabled and empty, and Save is off, until the values arrive.
 */
export function EmployeeFormSkeleton({ mode, oneCountry = false }: EmployeeFormSkeletonProps) {
  const { id } = useParams();
  const editing = (mode ?? (id ? 'edit' : 'add')) === 'edit';
  return (
    <PageSkeleton label={editing ? 'Loading employee…' : 'Loading form…'} delayMs={0}>
      <PageHeader
        title={
          editing ? (
            <>
              Edit <Skeleton inline width={200} height={26} />
            </>
          ) : (
            'Add employee'
          )
        }
        description={
          editing
            ? 'Pay, country and status change through their own actions, so they are not here.'
            : 'The starting salary becomes the first entry in their salary history.'
        }
      />
      <div className={styles.form}>
        <TrayCard title="Person" footer={editing ? undefined : 'Employee code is assigned on save'}>
          <div className={form.fieldset}>
            <div className={form.row}>
              <Field label="First name" />
              <Field label="Last name" />
            </div>
            <Field label="Work email" />
          </div>
        </TrayCard>
        <TrayCard title="Role">
          <div className={form.fieldset}>
            <div className={form.row}>
              <Field label="Department" kind="select" />
              <Field label="Job title" kind="select" />
            </div>
          </div>
        </TrayCard>
        <TrayCard title="Location and pay" footer="Currency is set by the country">
          <div className={form.fieldset}>
            <div className={form.row}>
              <Field label="Country" kind="select" />
              <Field label="Hire date" hint="Today or earlier" />
            </div>
            {!editing && (
              <Field
                label="Annual base salary"
                hint={oneCountry ? undefined : 'Choose the country first'}
              />
            )}
          </div>
        </TrayCard>
        <div className={form.actions}>
          <PillButton href={editing && id ? `/employees/${id}` : '/employees'}>Cancel</PillButton>
          {/* Nothing can be saved until the form has loaded. */}
          <PillButton tone="primary" disabled>
            {editing ? 'Save changes' : 'Save employee'}
          </PillButton>
        </div>
      </div>
    </PageSkeleton>
  );
}
