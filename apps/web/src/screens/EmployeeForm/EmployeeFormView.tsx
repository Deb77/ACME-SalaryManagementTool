import {
  createEmployeeRequestSchema,
  updateEmployeeRequestSchema,
  type CatalogueRef,
  type CountryInfo,
  type CreateEmployeeRequest,
  type Employee,
  type UpdateEmployeeRequest,
} from '@acme/shared';
import { useState } from 'react';
import {
  FormField,
  MoneyInput,
  MoneyText,
  Notice,
  PageHeader,
  PillButton,
  TrayCard,
} from '../../components';
import { formatCount, todayIso } from '../../lib/format';
import form from '../shared/form.module.css';
import { zodFieldErrors } from '../shared/formErrors';
import shared from '../shared/screen.module.css';
import styles from './EmployeeForm.module.css';
import { employeeFieldMessages, futureHireDateError } from './EmployeeForm.utils';

export interface RoleBenchmark {
  jobTitle: string;
  countryName: string;
  currency: string;
  headcount: number;
  minMinor: number;
  medianMinor: number;
  maxMinor: number;
}

interface Draft {
  firstName: string;
  lastName: string;
  email: string;
  departmentId: string;
  jobTitleId: string;
  country: string;
  hireDate: string;
  salaryAmountMinor: number | null;
}

export type EmployeeFormSubmit =
  { mode: 'create'; body: CreateEmployeeRequest } | { mode: 'edit'; body: UpdateEmployeeRequest };

export interface EmployeeFormViewProps {
  /** The employee being edited; omit to add a new one. */
  employee?: Employee;
  /** Countries the user may add employees in (their scope). */
  countries: readonly CountryInfo[];
  departments: readonly CatalogueRef[];
  jobTitles: readonly CatalogueRef[];
  /** Pay for the chosen title and country, shown as a guide; omitted without `insights:read`. */
  benchmark?: RoleBenchmark | null;
  /** Lets the container load the benchmark for the current choice. */
  onRoleChange?: (jobTitleId: string, country: string) => void;
  saving?: boolean;
  error?: string;
  serverErrors?: Record<string, string>;
  cancelHref: string;
  onSubmit: (submit: EmployeeFormSubmit) => void;
}

function initialDraft(employee: Employee | undefined, countries: readonly CountryInfo[]): Draft {
  return {
    firstName: employee?.firstName ?? '',
    lastName: employee?.lastName ?? '',
    email: employee?.email ?? '',
    departmentId: employee?.department.id ?? '',
    jobTitleId: employee?.jobTitle.id ?? '',
    country: employee?.country ?? (countries.length === 1 ? (countries[0]?.code ?? '') : ''),
    hireDate: employee?.hireDate ?? todayIso(),
    salaryAmountMinor: null,
  };
}

/** Add employee (and Edit details): the starting salary becomes the first history entry. */
export function EmployeeFormView({
  employee,
  countries,
  departments,
  jobTitles,
  benchmark,
  onRoleChange,
  saving = false,
  error,
  serverErrors = {},
  cancelHref,
  onSubmit,
}: EmployeeFormViewProps) {
  const editing = employee !== undefined;
  const [draft, setDraft] = useState<Draft>(() => initialDraft(employee, countries));
  const [clientErrors, setClientErrors] = useState<Record<string, string>>({});
  const errors = { ...serverErrors, ...clientErrors };
  const currency = countries.find((c) => c.code === draft.country)?.currency;

  const update = (patch: Partial<Draft>) => {
    const next = { ...draft, ...patch };
    setDraft(next);
    if (('jobTitleId' in patch || 'country' in patch) && next.jobTitleId && next.country) {
      onRoleChange?.(next.jobTitleId, next.country);
    }
  };

  const today = todayIso();

  const submit = () => {
    const messages = employeeFieldMessages(draft);
    const hireDateError = futureHireDateError(draft.hireDate, today);
    const fail = (parsedErrors: Record<string, string>) =>
      setClientErrors(hireDateError ? { hireDate: hireDateError, ...parsedErrors } : parsedErrors);
    if (editing) {
      const changed = Object.fromEntries(
        (['firstName', 'lastName', 'email', 'departmentId', 'jobTitleId', 'hireDate'] as const)
          .filter((key) => draft[key] !== initialDraft(employee, countries)[key])
          .map((key) => [key, draft[key]]),
      );
      const parsed = updateEmployeeRequestSchema.safeParse({
        ...changed,
        version: employee.version,
      });
      if (!parsed.success) return fail(zodFieldErrors(parsed.error, messages));
      if (hireDateError) return fail({});
      setClientErrors({});
      return onSubmit({ mode: 'edit', body: parsed.data });
    }
    const parsed = createEmployeeRequestSchema.safeParse({
      ...draft,
      salaryAmountMinor: draft.salaryAmountMinor ?? undefined,
    });
    if (!parsed.success) return fail(zodFieldErrors(parsed.error, messages));
    if (hireDateError) return fail({});
    setClientErrors({});
    onSubmit({ mode: 'create', body: parsed.data });
  };

  const text = (
    key: 'firstName' | 'lastName' | 'email',
    label: string,
    type = 'text',
    autoComplete = 'off',
  ) => (
    <FormField label={label} required error={errors[key]}>
      {(control) => (
        <input
          {...control}
          type={type}
          className={form.control}
          autoComplete={autoComplete}
          value={draft[key]}
          onChange={(event) => update({ [key]: event.currentTarget.value })}
        />
      )}
    </FormField>
  );

  const select = (
    key: 'departmentId' | 'jobTitleId' | 'country',
    label: string,
    options: readonly { value: string; label: string }[],
    disabled = false,
  ) => (
    <FormField label={label} required error={errors[key]}>
      {(control) => (
        <select
          {...control}
          className={form.control}
          value={draft[key]}
          disabled={disabled}
          onChange={(event) => update({ [key]: event.currentTarget.value })}
        >
          <option value="" disabled>
            Choose…
          </option>
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      )}
    </FormField>
  );

  const actions = (
    <>
      <PillButton href={cancelHref}>Cancel</PillButton>
      <PillButton tone="primary" loading={saving} onClick={submit}>
        {editing ? 'Save changes' : 'Save employee'}
      </PillButton>
    </>
  );

  return (
    <>
      <PageHeader
        title={editing ? `Edit ${employee.firstName} ${employee.lastName}` : 'Add employee'}
        description={
          editing
            ? 'Pay, country and status change through their own actions, so they are not here.'
            : 'The starting salary becomes the first entry in their salary history.'
        }
      />
      <form
        className={styles.form}
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <TrayCard title="Person" footer={editing ? undefined : 'Employee code is assigned on save'}>
          <fieldset className={form.fieldset}>
            <legend className="visually-hidden">Person</legend>
            <div className={form.row}>
              {text('firstName', 'First name', 'text', 'given-name')}
              {text('lastName', 'Last name', 'text', 'family-name')}
            </div>
            {text('email', 'Work email', 'email', 'email')}
          </fieldset>
        </TrayCard>
        <TrayCard
          title="Role"
          footer="Titles come from ACME's job catalogue, so insights group correctly"
        >
          <fieldset className={form.fieldset}>
            <legend className="visually-hidden">Role</legend>
            <div className={form.row}>
              {select(
                'departmentId',
                'Department',
                departments.map((d) => ({ value: d.id, label: d.name })),
              )}
              {select(
                'jobTitleId',
                'Job title',
                jobTitles.map((t) => ({ value: t.id, label: t.name })),
              )}
            </div>
          </fieldset>
        </TrayCard>
        <TrayCard title="Location and pay" footer="Currency is set by the country">
          <fieldset className={form.fieldset}>
            <legend className="visually-hidden">Location and pay</legend>
            <div className={form.row}>
              {select(
                'country',
                'Country',
                countries.map((c) => ({ value: c.code, label: c.name })),
                editing,
              )}
              <FormField label="Hire date" required hint="Today or earlier" error={errors.hireDate}>
                {(control) => (
                  <input
                    {...control}
                    type="date"
                    className={form.control}
                    max={today}
                    value={draft.hireDate}
                    onChange={(event) => update({ hireDate: event.currentTarget.value })}
                  />
                )}
              </FormField>
            </div>
            {!editing && (
              <FormField
                label="Annual base salary"
                required
                hint={currency ? undefined : 'Choose the country first'}
                error={errors.salaryAmountMinor}
              >
                {(control) =>
                  currency ? (
                    <MoneyInput
                      {...control}
                      key={currency}
                      currency={currency}
                      onChange={(salaryAmountMinor) => update({ salaryAmountMinor })}
                    />
                  ) : (
                    <input {...control} className={form.control} disabled value="" readOnly />
                  )
                }
              </FormField>
            )}
            {benchmark && (
              <div className={styles.benchmark}>
                <div className={styles.benchmarkTitle}>
                  {benchmark.jobTitle}s in {benchmark.countryName}
                </div>
                <div className={`${shared.small} ${shared.muted}`}>
                  {formatCount(benchmark.headcount)} people · median{' '}
                  <MoneyText amountMinor={benchmark.medianMinor} currency={benchmark.currency} /> ·
                  range{' '}
                  <MoneyText
                    amountMinor={benchmark.minMinor}
                    currency={benchmark.currency}
                    compact
                  />
                  –
                  <MoneyText
                    amountMinor={benchmark.maxMinor}
                    currency={benchmark.currency}
                    compact
                  />
                </div>
              </div>
            )}
          </fieldset>
        </TrayCard>
        {(error || clientErrors['']) && (
          <Notice tone="warning" title="Not saved">
            {error ?? clientErrors['']}
          </Notice>
        )}
        <div className={form.actions}>{actions}</div>
      </form>
    </>
  );
}
