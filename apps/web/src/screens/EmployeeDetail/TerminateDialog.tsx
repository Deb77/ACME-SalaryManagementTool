import {
  terminateEmployeeRequestSchema,
  type TerminateEmployeeRequest,
  type terminationReasons,
} from '@acme/shared';
import { useState } from 'react';
import { Dialog, FormField, PillButton } from '../../components';
import { terminationReasonLabel, todayIso } from '../../lib/format';
import form from '../shared/form.module.css';
import { zodFieldErrors } from '../shared/formErrors';
import { useFocusFirstError } from '../shared/useFocusFirstError';

type TerminationReason = (typeof terminationReasons)[number];

export interface TerminateDialogProps {
  open: boolean;
  name: string;
  version: number;
  reasons: readonly TerminationReason[];
  saving?: boolean;
  error?: string;
  onCancel: () => void;
  onConfirm: (body: TerminateEmployeeRequest) => void;
}

/** Record a leaver: they stay in reports and history, marked terminated from the date. */
export function TerminateDialog({
  open,
  name,
  version,
  reasons,
  saving = false,
  error,
  onCancel,
  onConfirm,
}: TerminateDialogProps) {
  const [terminationDate, setTerminationDate] = useState(todayIso());
  const [reason, setReason] = useState<TerminationReason>(reasons[0] ?? 'resignation');
  const [note, setNote] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { ref: fieldsRef, focusFirstError } = useFocusFirstError<HTMLDivElement>();

  const today = todayIso();

  const submit = () => {
    if (terminationDate > today) {
      setErrors({ terminationDate: 'Choose today or an earlier date' });
      return focusFirstError();
    }
    const parsed = terminateEmployeeRequestSchema.safeParse({
      terminationDate,
      reason,
      note: note.trim() || undefined,
      version,
    });
    if (!parsed.success) {
      setErrors(
        zodFieldErrors(parsed.error, { terminationDate: () => 'Enter the last working day' }),
      );
      return focusFirstError();
    }
    setErrors({});
    onConfirm(parsed.data);
  };

  return (
    <Dialog
      open={open}
      title={`Terminate ${name}?`}
      onClose={onCancel}
      busy={saving}
      width={480}
      footerNote="They stay in reports and salary history"
      actions={
        <>
          <PillButton onClick={onCancel} disabled={saving}>
            Cancel
          </PillButton>
          <PillButton tone="danger" loading={saving} onClick={submit}>
            Terminate
          </PillButton>
        </>
      }
    >
      <div ref={fieldsRef} className={form.form}>
        <FormField
          label="Last working day"
          required
          hint="Today or earlier"
          error={errors.terminationDate}
        >
          {(control) => (
            <input
              {...control}
              type="date"
              className={form.control}
              max={today}
              value={terminationDate}
              onChange={(event) => setTerminationDate(event.currentTarget.value)}
            />
          )}
        </FormField>
        <FormField label="Reason" required error={errors.reason}>
          {(control) => (
            <select
              {...control}
              className={form.control}
              value={reason}
              onChange={(event) => setReason(event.currentTarget.value as TerminationReason)}
            >
              {reasons.map((value) => (
                <option key={value} value={value}>
                  {terminationReasonLabel(value)}
                </option>
              ))}
            </select>
          )}
        </FormField>
        <FormField label="Note" optional error={errors.note}>
          {(control) => (
            <textarea
              {...control}
              className={form.control}
              rows={2}
              maxLength={500}
              value={note}
              onChange={(event) => setNote(event.currentTarget.value)}
            />
          )}
        </FormField>
        {error && (
          <p role="alert" className={form.error}>
            {error}
          </p>
        )}
      </div>
    </Dialog>
  );
}
