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

/** A real labelled field whose value is still loading. */
function Field({ label, width }: { label: string; width: string }) {
  return (
    <FormField label={label} required>
      {() => (
        <div className={form.control} style={{ display: 'grid', alignContent: 'center' }}>
          <Skeleton inline width={width} height={12} />
        </div>
      )}
    </FormField>
  );
}

/**
 * EmployeeFormView in edit mode while the employee loads. Labels, cards, footers and
 * buttons are the real ones; only the field values are placeholders.
 */
export function EmployeeFormSkeleton() {
  const { id } = useParams();
  return (
    <PageSkeleton label="Loading employee…">
      <PageHeader
        title={
          <>
            Edit <Skeleton inline width={200} height={26} />
          </>
        }
        description="Pay, country and status change through their own actions, so they are not here."
      />
      <div className={styles.form}>
        <TrayCard title="Person">
          <div className={form.fieldset}>
            <div className={form.row}>
              <Field label="First name" width="40%" />
              <Field label="Last name" width="45%" />
            </div>
            <Field label="Work email" width="50%" />
          </div>
        </TrayCard>
        <TrayCard
          title="Role"
          footer="Titles come from ACME's job catalogue, so insights group correctly"
        >
          <div className={form.fieldset}>
            <div className={form.row}>
              <Field label="Department" width="45%" />
              <Field label="Job title" width="60%" />
            </div>
          </div>
        </TrayCard>
        <TrayCard title="Location and pay" footer="Currency is set by the country">
          <div className={form.fieldset}>
            <div className={form.row}>
              <Field label="Country" width="35%" />
              <Field label="Hire date" width="40%" />
            </div>
          </div>
        </TrayCard>
        <div className={form.actions}>
          <PillButton href={id ? `/employees/${id}` : '/employees'}>Cancel</PillButton>
          <PillButton tone="primary">Save changes</PillButton>
        </div>
      </div>
    </PageSkeleton>
  );
}
