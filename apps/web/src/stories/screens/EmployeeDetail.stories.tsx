import type { Story } from '@ladle/react';
import { useState } from 'react';
import { ApiError } from '../../api/client';
import {
  EmployeeDetailView,
  type EmployeeDetailViewProps,
} from '../../screens/EmployeeDetail/EmployeeDetailView';
import { TerminateDialog } from '../../screens/EmployeeDetail/TerminateDialog';
import { SalaryChangeDialog } from '../../screens/SalaryChange/SalaryChangeDialog';
import {
  sampleDraft,
  sampleMeGlobal,
  sampleMeta,
  sampleMeViewer,
  samplePriya,
  sampleSalaryHistory,
  sampleTitleComparison,
} from '../screenSampleData';
import { ScreenFrame } from './ScreenFrame';

export default { title: 'Screens / Employee detail' };

const indiaBenchmark = sampleTitleComparison.rows.find((row) => row.country === 'IN');

const base: EmployeeDetailViewProps = {
  employee: samplePriya,
  countryName: 'India',
  history: { status: 'success', items: sampleSalaryHistory },
  benchmark: indiaBenchmark,
  canChangeSalary: true,
  canEdit: true,
  canTerminate: true,
  onRecordSalaryChange: () => {},
  onTerminate: () => {},
};

const subject = {
  name: 'Priya Sharma',
  employeeCode: samplePriya.employeeCode,
  jobTitle: samplePriya.jobTitle.name,
  countryName: 'India',
  salary: samplePriya.salary,
  version: samplePriya.version,
};

export const GlobalHr: Story = () => {
  const [dialog, setDialog] = useState<'salary' | 'terminate' | null>(null);
  return (
    <ScreenFrame me={sampleMeGlobal} path="/employees">
      <EmployeeDetailView
        {...base}
        onRecordSalaryChange={() => setDialog('salary')}
        onTerminate={() => setDialog('terminate')}
      />
      <SalaryChangeDialog
        open={dialog === 'salary'}
        onClose={() => setDialog(null)}
        employee={subject}
        reasons={sampleMeta.salaryChangeReasons}
        onSubmit={() => setDialog(null)}
      />
      <TerminateDialog
        open={dialog === 'terminate'}
        name="Priya Sharma"
        version={1}
        reasons={sampleMeta.terminationReasons}
        onCancel={() => setDialog(null)}
        onConfirm={() => setDialog(null)}
      />
    </ScreenFrame>
  );
};
GlobalHr.storyName = 'Global HR';
GlobalHr.meta = { fullscreen: true };

export const ReadOnly: Story = () => (
  <ScreenFrame me={sampleMeViewer} path="/employees">
    <EmployeeDetailView {...base} canChangeSalary={false} canEdit={false} canTerminate={false} />
  </ScreenFrame>
);
ReadOnly.storyName = 'Read-only role';
ReadOnly.meta = { fullscreen: true };

export const Terminated: Story = () => (
  <ScreenFrame me={sampleMeGlobal} path="/employees">
    <EmployeeDetailView
      {...base}
      employee={{
        ...samplePriya,
        status: 'terminated',
        termination: { date: '2026-10-31', reason: 'resignation', note: null },
      }}
    />
  </ScreenFrame>
);
Terminated.meta = { fullscreen: true };

export const HistoryStates: Story = () => (
  <ScreenFrame me={sampleMeGlobal} path="/employees">
    <EmployeeDetailView
      {...base}
      benchmark={null}
      history={{
        status: 'error',
        items: [],
        error: new ApiError(0, 'network_error', 'offline'),
        onRetry: () => {},
      }}
    />
  </ScreenFrame>
);
HistoryStates.storyName = 'History failed, no benchmark';
HistoryStates.meta = { fullscreen: true };

export const RecordSalaryChange: Story = () => (
  <SalaryChangeDialog
    open
    onClose={() => {}}
    employee={subject}
    reasons={sampleMeta.salaryChangeReasons}
    onSubmit={() => {}}
  />
);
RecordSalaryChange.storyName = 'Record salary change (sheet on phones)';

export const SalaryChangeFromAiDraft: Story = () => (
  <SalaryChangeDialog
    open
    onClose={() => {}}
    employee={subject}
    reasons={sampleMeta.salaryChangeReasons}
    draft={sampleDraft}
    error="Someone changed this employee since you opened them. Reload and try again."
    onSubmit={() => {}}
  />
);
SalaryChangeFromAiDraft.storyName = 'Record salary change from an AI draft, stale';

export const Terminate: Story = () => (
  <TerminateDialog
    open
    name="Priya Sharma"
    version={1}
    reasons={sampleMeta.terminationReasons}
    onCancel={() => {}}
    onConfirm={() => {}}
  />
);
