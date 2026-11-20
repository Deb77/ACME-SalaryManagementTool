import type {
  CountryInfo,
  Import,
  ImportField,
  ImportMapping,
  ImportOutcome,
  ImportRow,
  ImportUploadResponse,
} from '@acme/shared';
import { importFields } from '@acme/shared';
import { IconDownload, IconFileSpreadsheet } from '@tabler/icons-react';
import {
  DataTable,
  EmptyState,
  FileDropzone,
  FormField,
  Notice,
  PageHeader,
  PillButton,
  SegmentedControl,
  StatTile,
  Stepper,
  TrayCard,
  type DataTableColumn,
  type FileRejection,
} from '../../components';
import { formatMoney } from '../../lib/money';
import { formatCount } from '../../lib/format';
import form from '../shared/form.module.css';
import { ResourceState } from '../shared/ResourceState';
import shared from '../shared/screen.module.css';
import styles from './Import.module.css';
import {
  changeLabel,
  IMPORT_FIELD_LABELS,
  IMPORT_STEPS,
  OUTCOME_LABELS,
  STEP_INDEX,
  type ImportStep,
} from './Import.utils';

export interface ImportRowsPage {
  status: 'loading' | 'success' | 'error';
  items: readonly ImportRow[];
  total: number;
  page: number;
  pageSize: number;
  error?: unknown;
  onRetry?: () => void;
}

export interface ImportViewProps {
  step: ImportStep;
  /** Country HR only: which countries the file may change (decision #24). */
  scopeNote?: string;
  templateHref: string;
  error?: string;
  busy?: boolean;
  // Upload
  onFileSelected: (file: File) => void;
  onFileRejected: (file: File, reason: FileRejection) => void;
  // Match
  upload?: ImportUploadResponse;
  mapping: ImportMapping;
  onMappingChange: (mapping: ImportMapping) => void;
  defaults: { country?: string; salaryEffectiveDate?: string };
  onDefaultsChange: (defaults: { country?: string; salaryEffectiveDate?: string }) => void;
  countries: readonly CountryInfo[];
  onRunDryRun: () => void;
  // Review and done
  record?: Import;
  outcome: ImportOutcome;
  onOutcomeChange: (outcome: ImportOutcome) => void;
  rows: ImportRowsPage;
  onRowsPageChange: (page: number) => void;
  errorReportHref?: string;
  skipInvalidRows: boolean;
  onSkipInvalidRowsChange: (skip: boolean) => void;
  onCommit: () => void;
  onEditMatching: () => void;
  onStartOver: () => void;
  onUndo: () => void;
  /** Currency for salary changes in the review, when the import is for one country. */
  currency?: string;
}

const NOT_IN_FILE = '';

function describeValue(field: string, value: string | number | null, currency?: string) {
  if (value === null) return '—';
  if (field === 'salaryAmountMinor' && typeof value === 'number' && currency) {
    return formatMoney({ amountMinor: value, currency });
  }
  return String(value);
}

function rowDetail(row: ImportRow, currency?: string) {
  if (row.errors.length > 0) {
    return row.errors.map((e) => `${e.column}: ${e.message}`).join(' · ');
  }
  const changes = Object.entries(row.changes);
  if (changes.length === 0) return row.outcome === 'create' ? 'New employee' : 'No changes';
  return changes
    .map(
      ([field, { from, to }]) =>
        `${changeLabel(field)}: ${describeValue(field, from, currency)} → ${describeValue(field, to, currency)}`,
    )
    .join(' · ');
}

/** Import from Excel: upload → match columns → review the dry run → import (and undo). */
export function ImportView(props: ImportViewProps) {
  const { step, scopeNote, templateHref, error } = props;
  return (
    <>
      <PageHeader
        title="Import from Excel"
        description="Bring your existing sheet in as it is. Nothing changes until you confirm."
        actions={
          <PillButton href={templateHref} download icon={<IconDownload size={16} />}>
            Download template
          </PillButton>
        }
      />
      <Stepper label="Import progress" steps={IMPORT_STEPS} current={STEP_INDEX[step]} />
      {scopeNote && <Notice tone="info">{scopeNote}</Notice>}
      {error && (
        <Notice tone="warning" title="That didn't work">
          {error}
        </Notice>
      )}
      {step === 'upload' && <UploadStep {...props} />}
      {step === 'match' && <MatchStep {...props} />}
      {(step === 'review' || step === 'done') && <ReviewStep {...props} />}
    </>
  );
}

function UploadStep({ busy, onFileSelected, onFileRejected }: ImportViewProps) {
  return (
    <TrayCard
      title="Upload your file"
      footer="Up to 10,000 rows. Each row is matched by employee code, then email."
    >
      <FileDropzone
        accept=".xlsx,.csv"
        maxSizeBytes={5 * 1024 * 1024}
        disabled={busy}
        onFileSelected={onFileSelected}
        onFileRejected={onFileRejected}
      />
    </TrayCard>
  );
}

function FileSummary({
  upload,
  actions,
}: {
  upload: ImportUploadResponse;
  actions?: React.ReactNode;
}) {
  const matched = Object.keys(upload.suggestedMapping).length;
  return (
    <div className={styles.file}>
      <span className={styles.fileIcon} aria-hidden="true">
        <IconFileSpreadsheet size={22} />
      </span>
      <div className={styles.fileText}>
        <div className={styles.fileName}>{upload.fileName}</div>
        <div className={`${shared.small} ${shared.muted}`}>
          {upload.columns.length} columns · {matched} matched automatically
        </div>
      </div>
      {actions && <div className={styles.fileActions}>{actions}</div>}
    </div>
  );
}

function MatchStep({
  upload,
  mapping,
  onMappingChange,
  defaults,
  onDefaultsChange,
  countries,
  busy,
  onRunDryRun,
  onStartOver,
}: ImportViewProps) {
  if (!upload) return null;
  const select = (field: ImportField) => (
    <FormField key={field} label={IMPORT_FIELD_LABELS[field]}>
      {(control) => (
        <select
          {...control}
          className={form.control}
          value={mapping[field] ?? NOT_IN_FILE}
          onChange={(event) => {
            const value = event.currentTarget.value;
            const next = { ...mapping };
            if (value === NOT_IN_FILE) delete next[field];
            else next[field] = value;
            onMappingChange(next);
          }}
        >
          <option value={NOT_IN_FILE}>Not in my file</option>
          {upload.columns.map((column) => (
            <option key={column} value={column}>
              {column}
            </option>
          ))}
        </select>
      )}
    </FormField>
  );
  return (
    <>
      <FileSummary
        upload={upload}
        actions={
          <PillButton size="small" onClick={onStartOver}>
            Replace file
          </PillButton>
        }
      />
      <TrayCard
        title="Match columns"
        footer="We guessed from your headers. Check each field before the dry run."
      >
        <div className={styles.mappingGrid}>{importFields.map(select)}</div>
      </TrayCard>
      <TrayCard title="Defaults for missing values">
        <div className={form.row}>
          <FormField label="Country" hint="Used when the file has no country column">
            {(control) => (
              <select
                {...control}
                className={form.control}
                value={defaults.country ?? ''}
                onChange={(e) =>
                  onDefaultsChange({ ...defaults, country: e.currentTarget.value || undefined })
                }
              >
                <option value="">No default</option>
                {countries.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.name}
                  </option>
                ))}
              </select>
            )}
          </FormField>
          <FormField label="Salary effective date" hint="Used for every salary change in the file">
            {(control) => (
              <input
                {...control}
                type="date"
                className={form.control}
                value={defaults.salaryEffectiveDate ?? ''}
                onChange={(e) =>
                  onDefaultsChange({
                    ...defaults,
                    salaryEffectiveDate: e.currentTarget.value || undefined,
                  })
                }
              />
            )}
          </FormField>
        </div>
      </TrayCard>
      <div className={form.actions}>
        <PillButton onClick={onStartOver} disabled={busy}>
          Cancel
        </PillButton>
        <PillButton tone="primary" loading={busy} onClick={onRunDryRun}>
          Check rows
        </PillButton>
      </div>
    </>
  );
}

function ReviewStep({
  step,
  upload,
  record,
  outcome,
  onOutcomeChange,
  rows,
  onRowsPageChange,
  errorReportHref,
  skipInvalidRows,
  onSkipInvalidRowsChange,
  busy,
  onCommit,
  onEditMatching,
  onStartOver,
  onUndo,
  currency,
}: ImportViewProps) {
  const summary = record?.summary;
  if (!summary) return null;
  const done = step === 'done';
  const importable = summary.create + summary.update;
  const blocked = summary.error > 0 && !skipInvalidRows;
  const columns: DataTableColumn<ImportRow>[] = [
    { key: 'row', title: 'Row', render: (row) => row.rowNumber, width: 72 },
    { key: 'employee', title: 'Employee', render: (row) => row.employeeCode ?? 'New' },
    {
      key: 'detail',
      title: outcome === 'error' ? 'Problem' : 'Change',
      render: (row) => rowDetail(row, currency),
    },
  ];
  return (
    <>
      {upload && (
        <FileSummary
          upload={upload}
          actions={
            !done && (
              <>
                <PillButton size="small" onClick={onEditMatching}>
                  Edit matching
                </PillButton>
                <PillButton size="small" onClick={onStartOver}>
                  Replace file
                </PillButton>
              </>
            )
          }
        />
      )}
      {done && (
        <Notice
          tone="accent"
          title={
            record.status === 'undone'
              ? 'Import undone'
              : `Imported ${formatCount(importable)} rows`
          }
          action={
            record.status === 'committed' && (
              <PillButton onClick={onUndo} loading={busy}>
                Undo import
              </PillButton>
            )
          }
        >
          {record.status === 'undone'
            ? 'Every change from this file was reversed. Salary history keeps both entries.'
            : 'Each change is in salary history. You can undo this import until someone edits an employee it changed.'}
        </Notice>
      )}
      <div className={shared.tiles}>
        <StatTile
          variant="hero"
          label="New employees"
          value={formatCount(summary.create)}
          note="Added with a hire entry"
        />
        <StatTile label="Updates" value={formatCount(summary.update)} note="Changed fields only" />
        <StatTile
          label="Unchanged"
          value={formatCount(summary.unchanged)}
          note="Already match ACME"
        />
        <StatTile
          variant="warning"
          label="Need fixing"
          value={formatCount(summary.error)}
          note={summary.error ? 'Shown below' : 'None'}
        />
      </div>
      <div className={styles.reviewGrid}>
        <TrayCard
          title="Review rows"
          flush
          extra={
            <div className={styles.outcomes}>
              <SegmentedControl<ImportOutcome>
                label="Row outcome"
                size="small"
                options={(['error', 'update', 'create'] as const).map((value) => ({
                  value,
                  label: `${OUTCOME_LABELS[value]} ${formatCount(summary[value])}`,
                }))}
                value={outcome}
                onChange={onOutcomeChange}
              />
            </div>
          }
          footer={
            outcome === 'error' &&
            summary.error > 0 &&
            errorReportHref && (
              <PillButton tone="quiet" size="small" href={errorReportHref} download>
                Download error report (.csv)
              </PillButton>
            )
          }
        >
          <ResourceState
            status={rows.status}
            error={rows.error}
            onRetry={rows.onRetry}
            loadingLabel="Loading rows…"
            skeleton={
              <DataTable
                label={`${OUTCOME_LABELS[outcome]} rows`}
                columns={columns}
                rows={[]}
                rowKey={(row) => row.rowNumber}
                total={0}
                query={{ page: 1, pageSize: 6 }}
                onQueryChange={() => {}}
                skeletonRows={6}
              />
            }
          >
            <DataTable
              label={`${OUTCOME_LABELS[outcome]} rows`}
              columns={columns}
              rows={rows.items}
              rowKey={(row) => row.rowNumber}
              total={rows.total}
              query={{ page: rows.page, pageSize: rows.pageSize }}
              onQueryChange={(query) => onRowsPageChange(query.page)}
              itemName="rows"
              empty={<EmptyState title={`No ${OUTCOME_LABELS[outcome].toLowerCase()} rows`} />}
              renderCard={(row) => (
                <div className={styles.rowCard}>
                  <div className={styles.rowCardTop}>
                    <strong>{row.employeeCode ?? 'New employee'}</strong>
                    <span className={`${shared.small} ${shared.muted}`}>Row {row.rowNumber}</span>
                  </div>
                  <div className={row.errors.length ? styles.problem : shared.small}>
                    {rowDetail(row, currency)}
                  </div>
                </div>
              )}
            />
          </ResourceState>
        </TrayCard>
        {!done && (
          <TrayCard title="Before you import" as="aside">
            <div className={form.form}>
              {summary.error > 0 && (
                <fieldset className={form.fieldset}>
                  <legend className={form.legend}>Rows that need fixing</legend>
                  <label className={form.radio}>
                    <input
                      type="radio"
                      name="skip"
                      checked={skipInvalidRows}
                      onChange={() => onSkipInvalidRowsChange(true)}
                    />
                    Skip them for now
                  </label>
                  <label className={form.radio}>
                    <input
                      type="radio"
                      name="skip"
                      checked={!skipInvalidRows}
                      onChange={() => onSkipInvalidRowsChange(false)}
                    />
                    Stop and fix first
                  </label>
                  <p className={form.note}>
                    {skipInvalidRows
                      ? `Import the other ${formatCount(importable)} rows; fix the ${formatCount(summary.error)} later.`
                      : 'Nothing is imported until every row is valid. Fix your file and replace it.'}
                  </p>
                </fieldset>
              )}
              <ul className={styles.facts}>
                <li>Each salary change is added to salary history, so nothing is overwritten.</li>
                <li>You can undo this import until someone edits an employee it changed.</li>
              </ul>
              <PillButton
                tone="primary"
                loading={busy}
                disabled={blocked || importable === 0}
                onClick={onCommit}
              >
                {`Import ${formatCount(importable)} rows`}
              </PillButton>
            </div>
          </TrayCard>
        )}
      </div>
    </>
  );
}
