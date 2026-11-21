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
 * A real labelled field. In edit mode its value is still loading (a placeholder bar); in add
 * mode the form starts empty, so the control is empty too.
 */
function Field({
  label,
  width,
  hint,
  editing,
}: {
  label: string;
  width: string;
  hint?: string;
  editing: boolean;
}) {
  return (
    <FormField label={label} required hint={hint}>
      {() => (
        <div className={form.control} style={{ display: 'grid', alignContent: 'center' }}>
          {editing && <Skeleton inline width={width} height={12} />}
        </div>
      )}
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
 * only the edit form's values are placeholders.
 */
export function EmployeeFormSkeleton({ mode, oneCountry = false }: EmployeeFormSkeletonProps) {
  const { id } = useParams();
  const editing = (mode ?? (id ? 'edit' : 'add')) === 'edit';
  return (
    <PageSkeleton label={editing ? 'Loading employee…' : 'Loading form…'}>
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
              <Field label="First name" width="40%" editing={editing} />
              <Field label="Last name" width="45%" editing={editing} />
            </div>
            <Field label="Work email" width="50%" editing={editing} />
          </div>
        </TrayCard>
        <TrayCard title="Role">
          <div className={form.fieldset}>
            <div className={form.row}>
              <Field label="Department" width="45%" editing={editing} />
              <Field label="Job title" width="60%" editing={editing} />
            </div>
          </div>
        </TrayCard>
        <TrayCard title="Location and pay" footer="Currency is set by the country">
          <div className={form.fieldset}>
            <div className={form.row}>
              <Field label="Country" width="35%" editing={editing} />
              <Field label="Hire date" width="40%" hint="Today or earlier" editing={editing} />
            </div>
            {!editing && (
              <Field
                label="Annual base salary"
                width="0"
                hint={oneCountry ? undefined : 'Choose the country first'}
                editing={false}
              />
            )}
          </div>
        </TrayCard>
        <div className={form.actions}>
          <PillButton href={editing && id ? `/employees/${id}` : '/employees'}>Cancel</PillButton>
          {/* A new form starts empty, so its Save starts off, as in the real form. */}
          <PillButton tone="primary" disabled={!editing}>
            {editing ? 'Save changes' : 'Save employee'}
          </PillButton>
        </div>
      </div>
    </PageSkeleton>
  );
}
