import type {
  Import,
  ImportMapping,
  ImportOutcome,
  ImportRow,
  ImportUploadResponse,
} from '@acme/shared';
import { IconAlertCircle, IconFileSpreadsheet } from '@tabler/icons-react';
import { useState } from 'react';
import {
  ConfirmDialog,
  DataTable,
  EmptyState,
  Notice,
  PillButton,
  SegmentedControl,
  StatTile,
  TrayCard,
  type DataTableColumn,
  type FileRejection,
} from '../../components';
import { formatCount } from '../../lib/format';
import form from '../shared/form.module.css';
import { ResourceState } from '../shared/ResourceState';
import shared from '../shared/screen.module.css';
import styles from './Import.module.css';
import { ImportHeader, UploadCard } from './ImportSkeleton';
import { SheetPreview } from './SheetPreview';
import {
  OUTCOME_LABELS,
  rowDetail,
  rowProblems,
  rowSubtitle,
  rowTitle,
  STEP_INDEX,
  type ChangeContext,
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
  error?: string;
  busy?: boolean;
  // Upload
  onFileSelected: (file: File) => void;
  onFileRejected: (file: File, reason: FileRejection) => void;
  // Review and done
  upload?: ImportUploadResponse;
  /** The columns matched from the file's headers, shown on the preview. */
  mapping: ImportMapping;
  record?: Import;
  outcome: ImportOutcome;
  onOutcomeChange: (outcome: ImportOutcome) => void;
  rows: ImportRowsPage;
  onRowsPageChange: (page: number) => void;
  skipInvalidRows: boolean;
  onSkipInvalidRowsChange: (skip: boolean) => void;
  onCommit: () => void;
  onStartOver: () => void;
  onUndo: () => void;
  /** Catalogue names and the update currency, to describe each row's changes in words. */
  changeContext: ChangeContext;
}

/**
 * Import from Excel: upload (columns are matched from the headers and the rows checked at once)
 * → review the file and the dry run → import (and undo).
 */
export function ImportView(props: ImportViewProps) {
  const { step, scopeNote, error } = props;
  return (
    <>
      <ImportHeader current={STEP_INDEX[step]} />
      {scopeNote && <Notice tone="info">{scopeNote}</Notice>}
      {error && (
        <Notice tone="warning" title="That didn't work">
          {error}
        </Notice>
      )}
      {step === 'upload' && <UploadStep {...props} />}
      {(step === 'review' || step === 'done') && <ReviewStep {...props} />}
    </>
  );
}

/** The review's detail: a row's problems as a short list (one stays a line), else its changes. */
function RowDetail({ row, context }: { row: ImportRow; context: ChangeContext }) {
  const problems = rowProblems(row);
  if (problems.length > 1) {
    return (
      <ul className={styles.problemList}>
        {problems.map((problem, index) => (
          <li key={index}>{problem}</li>
        ))}
      </ul>
    );
  }
  return <>{rowDetail(row, context)}</>;
}

/** The person a review row is about, with their code (or "New employee") under the name. */
function RowPerson({ row }: { row: ImportRow }) {
  const subtitle = rowSubtitle(row);
  return (
    <span className={styles.person}>
      <span className={styles.personName}>{rowTitle(row)}</span>
      {subtitle && <span className={`${shared.small} ${shared.muted}`}>{subtitle}</span>}
    </span>
  );
}

function UploadStep({ busy, onFileSelected, onFileRejected }: ImportViewProps) {
  return <UploadCard busy={busy} onFileSelected={onFileSelected} onFileRejected={onFileRejected} />;
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

function ReviewStep({
  step,
  upload,
  mapping,
  record,
  outcome,
  onOutcomeChange,
  rows,
  onRowsPageChange,
  skipInvalidRows,
  onSkipInvalidRowsChange,
  busy,
  onCommit,
  onStartOver,
  onUndo,
  changeContext,
}: ImportViewProps) {
  const [confirmingUndo, setConfirmingUndo] = useState(false);
  const summary = record?.summary;
  if (!summary) return null;
  const done = step === 'done';
  const importable = summary.create + summary.update;
  const blocked = summary.error > 0 && !skipInvalidRows;
  const columns: DataTableColumn<ImportRow>[] = [
    { key: 'row', title: 'Row', render: (row) => row.rowNumber, width: 72 },
    { key: 'employee', title: 'Employee', render: (row) => <RowPerson row={row} /> },
    {
      key: 'detail',
      title: outcome === 'error' ? 'Problem' : 'Change',
      render: (row) =>
        row.errors.length ? (
          // Red with an icon, so a problem reads as one without relying on colour alone.
          <span className={styles.problemCell}>
            <IconAlertCircle aria-hidden="true" size={16} className={styles.problemIcon} />
            <span>
              <RowDetail row={row} context={changeContext} />
            </span>
          </span>
        ) : (
          <RowDetail row={row} context={changeContext} />
        ),
    },
  ];
  return (
    <>
      {upload && (
        <FileSummary
          upload={upload}
          actions={
            !done && (
              <PillButton size="small" onClick={onStartOver}>
                Replace file
              </PillButton>
            )
          }
        />
      )}
      {upload && !done && (
        <TrayCard
          title="Preview"
          footer={
            upload.rowCount > upload.sampleRows.length
              ? `First ${upload.sampleRows.length} of ${formatCount(upload.rowCount)} rows, as they are in your file`
              : `All ${formatCount(upload.rowCount)} ${upload.rowCount === 1 ? 'row' : 'rows'}, as they are in your file`
          }
        >
          <SheetPreview upload={upload} mapping={mapping} />
        </TrayCard>
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
              <PillButton onClick={() => setConfirmingUndo(true)} loading={busy}>
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
                    <RowPerson row={row} />
                    <span className={`${styles.rowNumber} ${shared.small} ${shared.muted}`}>
                      Row {row.rowNumber}
                    </span>
                  </div>
                  {row.errors.length ? (
                    <div className={`${styles.problemCell} ${shared.small}`}>
                      <IconAlertCircle
                        aria-hidden="true"
                        size={16}
                        className={styles.problemIcon}
                      />
                      <div>
                        <RowDetail row={row} context={changeContext} />
                      </div>
                    </div>
                  ) : (
                    <div className={shared.small}>
                      <RowDetail row={row} context={changeContext} />
                    </div>
                  )}
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
      <ConfirmDialog
        open={confirmingUndo}
        title="Undo this import?"
        description={
          <ul className={styles.undoList}>
            {summary.create > 0 && (
              <li>
                {`Deletes the ${formatCount(summary.create)} ${summary.create === 1 ? 'employee' : 'employees'} it added, with their salary history.`}
              </li>
            )}
            {summary.update > 0 && (
              <li>
                {`Puts the ${formatCount(summary.update)} ${summary.update === 1 ? 'employee' : 'employees'} it updated back as they were; their salary history gains an "Import undone" entry.`}
              </li>
            )}
            <li>This can't be redone. To bring the rows back, import the file again.</li>
          </ul>
        }
        confirmLabel="Undo import"
        cancelLabel="Keep import"
        danger
        onCancel={() => setConfirmingUndo(false)}
        onConfirm={() => {
          setConfirmingUndo(false);
          onUndo();
        }}
      />
    </>
  );
}
