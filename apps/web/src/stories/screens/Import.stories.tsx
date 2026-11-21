import type { Story } from '@ladle/react';
import type { ImportOutcome } from '@acme/shared';
import { useState } from 'react';
import type { ImportStep } from '../../screens/Import/Import.utils';
import { ImportView, type ImportViewProps } from '../../screens/Import/ImportView';
import {
  sampleImportErrors,
  sampleImportSummary,
  sampleImportUpdates,
  sampleMeCountry,
  sampleMeGlobal,
  sampleMeta,
  sampleUpload,
} from '../screenSampleData';
import { ScreenFrame } from './ScreenFrame';

export default { title: 'Screens / Import from Excel' };

const record = {
  id: sampleUpload.id,
  status: 'validated' as const,
  fileName: sampleUpload.fileName,
  summary: sampleImportSummary,
  createdAt: '2026-11-20T09:00:00.000Z',
};

function Import({ step: initial, ...overrides }: Partial<ImportViewProps> & { step: ImportStep }) {
  const [step, setStep] = useState(initial);
  const [outcome, setOutcome] = useState<ImportOutcome>('error');
  const [skip, setSkip] = useState(true);
  const items =
    outcome === 'error' ? sampleImportErrors : outcome === 'update' ? sampleImportUpdates : [];
  return (
    <ImportView
      step={step}
      onFileSelected={() => setStep('review')}
      onFileRejected={() => {}}
      upload={sampleUpload}
      mapping={sampleUpload.suggestedMapping}
      record={step === 'done' ? { ...record, status: 'committed' } : record}
      outcome={outcome}
      onOutcomeChange={setOutcome}
      rows={{ status: 'success', items, total: items.length, page: 1, pageSize: 25 }}
      onRowsPageChange={() => {}}
      skipInvalidRows={skip}
      onSkipInvalidRowsChange={setSkip}
      onCommit={() => setStep('done')}
      onStartOver={() => setStep('upload')}
      onUndo={() => {}}
      changeContext={{
        countries: sampleMeta.countries,
        jobTitles: sampleMeta.jobTitles,
        departments: sampleMeta.departments,
        updateCurrency: 'INR',
      }}
      {...overrides}
    />
  );
}

export const Upload: Story = () => (
  <ScreenFrame me={sampleMeGlobal} path="/employees">
    <Import step="upload" />
  </ScreenFrame>
);
Upload.meta = { fullscreen: true };

export const Review: Story = () => (
  <ScreenFrame me={sampleMeGlobal} path="/employees">
    <Import step="review" />
  </ScreenFrame>
);
Review.storyName = 'Review the dry run';
Review.meta = { fullscreen: true };

export const ReviewCountryHr: Story = () => (
  <ScreenFrame me={sampleMeCountry} path="/employees">
    <Import
      step="review"
      scopeNote="Rows for countries outside your access (India) are reported as errors."
      error="Someone else changed 2 of these employees. Run the check again."
    />
  </ScreenFrame>
);
ReviewCountryHr.storyName = 'Review, Country HR with an error';
ReviewCountryHr.meta = { fullscreen: true };

export const Done: Story = () => (
  <ScreenFrame me={sampleMeGlobal} path="/employees">
    <Import step="done" />
  </ScreenFrame>
);
Done.storyName = 'Imported (undo available)';
Done.meta = { fullscreen: true };
