import type { Story } from '@ladle/react';
import { IconPencil, IconTrash } from '@tabler/icons-react';
import { useState } from 'react';
import {
  ChatComposer,
  CheckList,
  ChoiceChips,
  IconButton,
  KeyValueList,
  MoneyText,
  Notice,
  PillButton,
  RoleCard,
} from '../components';

export default { title: 'Molecules / Notices, lists and choices' };

const stack = { display: 'flex', flexDirection: 'column' as const, gap: 16, maxWidth: 720 };

export const Notices: Story = () => (
  <div style={stack}>
    <Notice tone="info">Rows for countries outside your access are reported as errors.</Notice>
    <Notice tone="warning" title="Not saved">
      Someone changed this employee since you opened them.
    </Notice>
    <Notice
      tone="accent"
      title="3 salary changes drafted"
      action={<PillButton tone="primary">Review drafts</PillButton>}
    >
      Nothing is saved until you review each one.
    </Notice>
  </div>
);

export const KeyValues: Story = () => (
  <div style={stack}>
    <KeyValueList
      layout="grid"
      items={[
        { label: 'Employee code', value: 'ACME-00042' },
        { label: 'Work email', value: 'priya.sharma@acme.com' },
        { label: 'Department', value: 'Engineering' },
        { label: 'Hire date', value: '14 Mar 2021' },
        { label: 'Salary', value: <MoneyText amountMinor={324_000_000} currency="INR" strong /> },
      ]}
    />
    <KeyValueList
      items={[
        { label: 'Country', value: 'India' },
        { label: 'Currency', value: 'INR' },
      ]}
    />
  </div>
);
KeyValues.storyName = 'Key value list';

const permissions = [
  { label: 'See employees and salaries', allowed: true },
  { label: 'Record salary changes', allowed: true },
  { label: 'Manage users and roles', allowed: false },
];

export const Checks: Story = () => (
  <div style={stack}>
    <CheckList items={permissions} />
    <div style={{ background: 'var(--acme-color-accent-strong)', padding: 16, borderRadius: 16 }}>
      <CheckList inverted items={permissions} />
    </div>
  </div>
);
Checks.storyName = 'Check list';

export const Chips: Story = () => {
  const [value, setValue] = useState<string[]>(['IN']);
  return (
    <div style={stack}>
      <ChoiceChips
        legend="Countries"
        columns={2}
        value={value}
        onChange={setValue}
        hint="They only see employees in these countries."
        options={[
          { value: 'IN', label: 'India', detail: '2,140' },
          { value: 'GB', label: 'United Kingdom', detail: '1,320' },
          { value: 'US', label: 'United States', detail: '1,880' },
          { value: 'DE', label: 'Germany', detail: '640', disabled: true },
        ]}
      />
      <ChoiceChips
        legend="Permissions"
        columns={1}
        value={[]}
        onChange={() => {}}
        error="Choose at least one permission."
        options={[
          { value: 'read', label: 'See employees and salaries' },
          { value: 'write', label: 'Add and edit employees' },
        ]}
      />
    </div>
  );
};
Chips.storyName = 'Choice chips';

export const Composer: Story = () => {
  const [value, setValue] = useState('');
  return (
    <div style={stack}>
      <ChatComposer
        value={value}
        onChange={setValue}
        onSubmit={() => setValue('')}
        hint="Answers cover all countries. Nothing is saved without your review."
      />
      <ChatComposer value="And in Brazil?" onChange={() => {}} onSubmit={() => {}} busy />
    </div>
  );
};
Composer.storyName = 'Chat composer';

export const RoleCards: Story = () => (
  <div
    style={{
      display: 'grid',
      gap: 16,
      gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
    }}
  >
    <RoleCard
      hero
      name="Global HR"
      scope="All countries"
      badge="Full access"
      permissions={permissions.map((p) => ({ ...p, allowed: true }))}
      footer="2 people · System role"
    />
    <RoleCard
      name="Country HR"
      scope="Only the countries assigned to them"
      badge="Scoped"
      permissions={permissions}
      footer="6 people"
      actions={
        <>
          <IconButton label="Edit Country HR" icon={<IconPencil size={18} />} />
          <IconButton label="Delete Country HR" icon={<IconTrash size={18} />} />
        </>
      }
    />
  </div>
);
RoleCards.storyName = 'Role card';
