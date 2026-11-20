import type { ReactNode } from 'react';
import { Dialog } from '../Dialog/Dialog';
import { PillButton } from '../../atoms/PillButton/PillButton';

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  /** What will happen, in plain words. */
  description: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  /** Destructive actions (Terminate, Remove access) use the danger tone. */
  danger?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/** Asks before an action that is hard to undo, naming the action on the button. */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel = 'Cancel',
  danger = false,
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <Dialog
      open={open}
      title={title}
      onClose={onCancel}
      width={480}
      busy={loading}
      actions={
        <>
          <PillButton onClick={onCancel} disabled={loading}>
            {cancelLabel}
          </PillButton>
          <PillButton tone={danger ? 'danger' : 'primary'} loading={loading} onClick={onConfirm}>
            {confirmLabel}
          </PillButton>
        </>
      }
    >
      {description}
    </Dialog>
  );
}
