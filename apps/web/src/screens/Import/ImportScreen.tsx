import type { Import, ImportMapping, ImportOutcome, ImportUploadResponse } from '@acme/shared';
import { useState } from 'react';
import { describeError } from '../../api/client';
import {
  commitImport,
  IMPORT_TEMPLATE_URL,
  importErrorReportUrl,
  listImportRows,
  setImportMapping,
  undoImport,
  uploadImport,
} from '../../api/endpoints';
import { useResource } from '../../api/useResource';
import { todayIso } from '../../lib/format';
import { useSession } from '../../session/SessionContext';
import type { ImportStep } from './Import.utils';
import { ImportView } from './ImportView';

/** Container for `/employees/import`: drives the upload → mapping → dry run → commit flow. */
export function ImportScreen() {
  const { me, meta, countryName, country } = useSession();
  const [step, setStep] = useState<ImportStep>('upload');
  const [upload, setUpload] = useState<ImportUploadResponse>();
  const [mapping, setMapping] = useState<ImportMapping>({});
  const [defaults, setDefaults] = useState<{ country?: string; salaryEffectiveDate?: string }>({});
  const [record, setRecord] = useState<Import>();
  const [outcome, setOutcome] = useState<ImportOutcome>('error');
  const [page, setPage] = useState(1);
  const [skipInvalidRows, setSkipInvalidRows] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  const reviewing = (step === 'review' || step === 'done') && record;
  const rows = useResource(
    reviewing ? `import-rows-${record.id}-${outcome}-${page}-${record.status}` : null,
    (signal) => listImportRows(record?.id ?? '', outcome, page, { signal }),
  );

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError(undefined);
    try {
      await action();
    } catch (caught) {
      setError(describeError(caught));
    } finally {
      setBusy(false);
    }
  }

  const startOver = () => {
    setStep('upload');
    setUpload(undefined);
    setRecord(undefined);
    setMapping({});
    setError(undefined);
  };

  const scoped = me.role.countryScope !== 'all';
  // Update rows carry no country. It is certain only for a one-country user, or when the file
  // has no country column: then every matched employee must be in the default country.
  const updateCountry =
    me.countries.length === 1
      ? me.countries[0]
      : mapping.country === undefined
        ? defaults.country
        : undefined;
  const rowsPage = rows.data ?? rows.previous;

  return (
    <ImportView
      step={step}
      scopeNote={
        scoped
          ? `Rows for countries outside your access (${me.countries.map(countryName).join(', ')}) are reported as errors.`
          : undefined
      }
      templateHref={IMPORT_TEMPLATE_URL}
      error={error}
      busy={busy}
      onFileSelected={(file) =>
        run(async () => {
          const uploaded = await uploadImport(file);
          setUpload(uploaded);
          setMapping(uploaded.suggestedMapping);
          setDefaults({
            country: me.countries.length === 1 ? me.countries[0] : undefined,
            salaryEffectiveDate: todayIso(),
          });
          setStep('match');
        })
      }
      onFileRejected={(_file, reason) =>
        setError(reason === 'size' ? 'That file is over 5 MB.' : 'Upload an .xlsx or .csv file.')
      }
      upload={upload}
      mapping={mapping}
      onMappingChange={setMapping}
      defaults={defaults}
      onDefaultsChange={setDefaults}
      countries={meta.countries.filter((c) => me.countries.includes(c.code))}
      onRunDryRun={() =>
        run(async () => {
          if (!upload) return;
          const result = await setImportMapping(upload.id, { mapping, defaults });
          setRecord(result);
          setOutcome(result.summary && result.summary.error > 0 ? 'error' : 'update');
          setPage(1);
          setStep('review');
        })
      }
      record={record}
      outcome={outcome}
      onOutcomeChange={(next) => {
        setOutcome(next);
        setPage(1);
      }}
      rows={{
        status:
          rows.status === 'error' ? 'error' : rows.status === 'success' ? 'success' : 'loading',
        items: rowsPage?.items ?? [],
        total: rowsPage?.total ?? 0,
        page,
        pageSize: rowsPage?.pageSize ?? 25,
        error: rows.error,
        onRetry: rows.reload,
      }}
      onRowsPageChange={setPage}
      errorReportHref={record ? importErrorReportUrl(record.id) : undefined}
      skipInvalidRows={skipInvalidRows}
      onSkipInvalidRowsChange={setSkipInvalidRows}
      onCommit={() =>
        run(async () => {
          if (!record) return;
          setRecord(await commitImport(record.id, { skipInvalidRows }));
          setStep('done');
        })
      }
      onEditMatching={() => setStep('match')}
      onStartOver={startOver}
      onUndo={() =>
        run(async () => {
          if (!record) return;
          setRecord(await undoImport(record.id));
        })
      }
      changeContext={{
        countries: meta.countries,
        jobTitles: meta.jobTitles,
        departments: meta.departments,
        updateCurrency: updateCountry ? country(updateCountry)?.currency : undefined,
      }}
    />
  );
}
