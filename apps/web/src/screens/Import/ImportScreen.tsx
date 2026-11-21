import type { Import, ImportMapping, ImportOutcome, ImportUploadResponse } from '@acme/shared';
import { useState } from 'react';
import { describeError } from '../../api/client';
import {
  commitImport,
  listImportRows,
  setImportMapping,
  undoImport,
  uploadImport,
} from '../../api/endpoints';
import { useResource } from '../../api/useResource';
import { todayIso } from '../../lib/format';
import { useSession } from '../../session/SessionContext';
import { scopeNoteFor, type ImportStep } from './Import.utils';
import { ImportView } from './ImportView';

/** Container for `/employees/import`: drives the upload → dry run → commit flow. */
export function ImportScreen() {
  const { me, meta, countryName, country } = useSession();
  const [step, setStep] = useState<ImportStep>('upload');
  const [upload, setUpload] = useState<ImportUploadResponse>();
  const [mapping, setMapping] = useState<ImportMapping>({});
  // Without a country column, a one-country user's rows are in their country.
  const defaultCountry = me.countries.length === 1 ? me.countries[0] : undefined;
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
        ? defaultCountry
        : undefined;
  const rowsPage = rows.data ?? rows.previous;

  return (
    <ImportView
      step={step}
      scopeNote={scoped ? scopeNoteFor(me.countries.map(countryName)) : undefined}
      error={error}
      busy={busy}
      onFileSelected={(file) =>
        run(async () => {
          // Columns are matched from the headers and the rows checked straight away: the review
          // shows the file next to what would change, so there is no separate matching step.
          const uploaded = await uploadImport(file);
          const result = await setImportMapping(uploaded.id, {
            mapping: uploaded.suggestedMapping,
            defaults: { country: defaultCountry, salaryEffectiveDate: todayIso() },
          });
          setUpload(uploaded);
          setMapping(uploaded.suggestedMapping);
          setRecord(result);
          setOutcome(result.summary && result.summary.error > 0 ? 'error' : 'update');
          setPage(1);
          setStep('review');
        })
      }
      onFileRejected={(_file, reason) =>
        setError(reason === 'size' ? 'That file is over 5 MB.' : 'Upload an .xlsx or .csv file.')
      }
      upload={upload}
      mapping={mapping}
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
      skipInvalidRows={skipInvalidRows}
      onSkipInvalidRowsChange={setSkipInvalidRows}
      onCommit={() =>
        run(async () => {
          if (!record) return;
          setRecord(await commitImport(record.id, { skipInvalidRows }));
          setStep('done');
        })
      }
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
