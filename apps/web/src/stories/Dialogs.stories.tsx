import type { Story } from '@ladle/react';
import { useState } from 'react';
import {
  ConfirmDialog,
  Dialog,
  FormField,
  MoneyInput,
  PersonCell,
  PillButton,
} from '../components';

export default { title: 'Organisms / Dialogs' };

export const RecordSalaryChange: Story = () => {
  const [open, setOpen] = useState(true);
  return (
    <>
      <PillButton tone="primary" onClick={() => setOpen(true)}>
        Record salary change
      </PillButton>
      <Dialog
        open={open}
        title="Record salary change"
        onClose={() => setOpen(false)}
        footerNote="Saved changes are permanent"
        actions={
          <>
            <PillButton onClick={() => setOpen(false)}>Cancel</PillButton>
            <PillButton tone="primary" onClick={() => setOpen(false)}>
              Save change
            </PillButton>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <PersonCell name="Priya Sharma" detail="ACME-00042 · Senior Software Engineer · India" />
          <FormField label="New annual salary">
            {(control) => (
              <MoneyInput
                {...control}
                currency="INR"
                defaultValueMinor={350_000_000}
                onChange={() => {}}
              />
            )}
          </FormField>
        </div>
      </Dialog>
    </>
  );
};

export const ConfirmTerminate: Story = () => {
  const [open, setOpen] = useState(true);
  return (
    <>
      <PillButton tone="danger" onClick={() => setOpen(true)}>
        Terminate
      </PillButton>
      <ConfirmDialog
        open={open}
        title="Terminate Priya Sharma?"
        description="She stays in reports and salary history, marked as terminated from the date you choose."
        confirmLabel="Terminate"
        danger
        onConfirm={() => setOpen(false)}
        onCancel={() => setOpen(false)}
      />
    </>
  );
};
