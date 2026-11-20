import type { Story } from '@ladle/react';
import { Select, Textarea, TextInput } from '@mantine/core';
import { useState } from 'react';
import { FileDropzone, FormField, MoneyInput, TrayCard } from '../components';
import { formatMoney } from '../lib/money';
import { grid } from './layout';

export default { title: 'Molecules / Form fields' };

export const LocationAndPay: Story = () => {
  const [newSalary, setNewSalary] = useState<number | null>(350_000_000);
  return (
    <TrayCard title="Location and pay" footer="Currency is set by the country">
      <div style={grid(220)}>
        <FormField label="Country">
          {(control) => (
            <Select {...control} defaultValue="IN" data={[{ value: 'IN', label: 'India' }]} />
          )}
        </FormField>
        <FormField label="Work email" error="Already used by ACME-04217 (Neha Bansal, Sales).">
          {(control) => (
            <TextInput
              {...control}
              error={control['aria-invalid']}
              defaultValue="neha.bansal@acme.com"
            />
          )}
        </FormField>
        <FormField
          label="Annual base salary"
          hint={
            newSalary === null
              ? 'Enter an amount'
              : `Saved as ${formatMoney({ amountMinor: newSalary, currency: 'INR' })}`
          }
        >
          {(control) => (
            <MoneyInput
              {...control}
              currency="INR"
              defaultValueMinor={350_000_000}
              onChange={setNewSalary}
            />
          )}
        </FormField>
        <FormField label="Note" optional>
          {(control) => <Textarea {...control} rows={2} />}
        </FormField>
      </div>
    </TrayCard>
  );
};

export const Dropzone: Story = () => {
  const [result, setResult] = useState('No file chosen yet');
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <FileDropzone
        onFileSelected={(file) => setResult(`Selected ${file.name}`)}
        onFileRejected={(file, reason) =>
          setResult(`${file.name}: ${reason === 'size' ? 'too large' : 'not .xlsx or .csv'}`)
        }
      />
      <output>{result}</output>
    </div>
  );
};
