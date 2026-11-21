import {
  createSalaryChangeRequestSchema,
  type CreateSalaryChangeRequest,
  type Money,
  type SalaryChangeDraft,
} from '@acme/shared';
import { useState } from 'react';
import {
  Dialog,
  FormField,
  MoneyInput,
  MoneyText,
  Notice,
  PersonCell,
  PillButton,
} from '../../components';
import { percentChange, salaryReasonLabel, todayIso } from '../../lib/format';
import form from '../shared/form.module.css';
import { zodFieldErrors } from '../shared/formErrors';
import { useFocusFirstError } from '../shared/useFocusFirstError';
import styles from './SalaryChangeDialog.module.css';

export interface SalaryChangeSubject {
  name: string;
  employeeCode: string;
  jobTitle: string;
  countryName: string;
  salary: Money;
  version: number;
}

export interface SalaryChangeDialogProps {
  open: boolean;
  onClose: () => void;
  employee: SalaryChangeSubject;
  reasons: readonly CreateSalaryChangeRequest['reason'][];
  /** Ask AI draft to prefill; its id is sent so the audit log records where the change began. */
  draft?: SalaryChangeDraft;
  saving?: boolean;
  /** Form-level failure (stale version, permissions) in plain words. */
  error?: string;
  /** Field errors returned by the server, keyed by request field. */
  serverErrors?: Record<string, string>;
  onSubmit: (body: CreateSalaryChangeRequest) => void;
}

const REASONS_NEEDING_NOTE = new Set(['correction', 'other']);

/**
 * Record salary change: the only way pay changes. A centred dialog from tablet width and a
 * bottom sheet on phones (Dialog handles both). Validates with the shared request schema.
 */
export function SalaryChangeDialog({
  open,
  onClose,
  employee,
  reasons,
  draft,
  saving = false,
  error,
  serverErrors = {},
  onSubmit,
}: SalaryChangeDialogProps) {
  const [amountMinor, setAmountMinor] = useState<number | null>(
    draft?.proposedAmount.amountMinor ?? null,
  );
  const [effectiveDate, setEffectiveDate] = useState(draft?.effectiveDate ?? todayIso());
  const [reason, setReason] = useState<CreateSalaryChangeRequest['reason']>(
    draft?.reason ?? reasons[0] ?? 'annual_review',
  );
  const [note, setNote] = useState(draft?.note ?? '');
  const [clientErrors, setClientErrors] = useState<Record<string, string>>({});
  const errors = { ...serverErrors, ...clientErrors };
  const { ref: formRef, focusFirstError } = useFocusFirstError<HTMLFormElement>();
  const currency = employee.salary.currency;
  const delta = amountMinor === null ? null : amountMinor - employee.salary.amountMinor;
  const noteRequired = REASONS_NEEDING_NOTE.has(reason);

  const submit = () => {
    const parsed = createSalaryChangeRequestSchema.safeParse({
      amountMinor: amountMinor ?? undefined,
      effectiveDate,
      reason,
      note: note.trim() || undefined,
      version: employee.version,
      aiDraftId: draft?.draftId,
    });
    if (!parsed.success) {
      const fieldErrors = zodFieldErrors(parsed.error);
      if (fieldErrors.amountMinor) fieldErrors.amountMinor = 'Enter the new annual salary';
      setClientErrors(fieldErrors);
      focusFirstError();
      return;
    }
    setClientErrors({});
    onSubmit(parsed.data);
  };

  return (
    <Dialog
      open={open}
      title="Record salary change"
      onClose={onClose}
      busy={saving}
      footerNote="Saved changes are permanent"
      actions={
        <>
          <PillButton onClick={onClose} disabled={saving}>
            Cancel
          </PillButton>
          <PillButton tone="primary" loading={saving} onClick={submit}>
            Save change
          </PillButton>
        </>
      }
    >
      <form
        ref={formRef}
        className={form.form}
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <PersonCell
          name={employee.name}
          detail={`${employee.employeeCode} · ${employee.jobTitle} · ${employee.countryName}`}
          wrapDetail
        />
        {draft && (
          <Notice tone="accent" title="Drafted by Ask AI">
            Check the amount and reason. Nothing is saved until you press Save change.
          </Notice>
        )}
        <dl className={styles.summary}>
          <div className={styles.summaryCell}>
            <dt>Current</dt>
            <dd>
              <MoneyText {...employee.salary} strong />
            </dd>
          </div>
          <div className={styles.summaryCell}>
            <dt>Change</dt>
            <dd>
              {delta === null ? (
                '—'
              ) : (
                <>
                  <MoneyText amountMinor={delta} currency={currency} signed strong />{' '}
                  <span className={styles.percent}>
                    {percentChange(employee.salary.amountMinor, amountMinor ?? 0)}
                  </span>
                </>
              )}
            </dd>
          </div>
        </dl>
        <FormField label="New annual salary" required error={errors.amountMinor}>
          {(control) => (
            <MoneyInput
              {...control}
              currency={currency}
              defaultValueMinor={draft?.proposedAmount.amountMinor ?? null}
              onChange={setAmountMinor}
            />
          )}
        </FormField>
        <div className={form.row}>
          <FormField
            label="Effective date"
            required
            hint="Today or earlier"
            error={errors.effectiveDate}
          >
            {(control) => (
              <input
                {...control}
                type="date"
                className={form.control}
                max={todayIso()}
                value={effectiveDate}
                onChange={(event) => setEffectiveDate(event.currentTarget.value)}
              />
            )}
          </FormField>
          <FormField label="Reason" required error={errors.reason}>
            {(control) => (
              <select
                {...control}
                className={form.control}
                value={reason}
                onChange={(event) =>
                  setReason(event.currentTarget.value as CreateSalaryChangeRequest['reason'])
                }
              >
                {reasons.map((value) => (
                  <option key={value} value={value}>
                    {salaryReasonLabel(value)}
                  </option>
                ))}
              </select>
            )}
          </FormField>
        </div>
        <FormField
          label="Note"
          optional={!noteRequired}
          required={noteRequired}
          hint={
            noteRequired ? `Required for ${salaryReasonLabel(reason).toLowerCase()}` : undefined
          }
          error={errors.note}
        >
          {(control) => (
            <textarea
              {...control}
              className={form.control}
              rows={3}
              maxLength={500}
              value={note}
              onChange={(event) => setNote(event.currentTarget.value)}
            />
          )}
        </FormField>
        {error && (
          <p role="alert" className={styles.error}>
            {error}
          </p>
        )}
      </form>
    </Dialog>
  );
}
