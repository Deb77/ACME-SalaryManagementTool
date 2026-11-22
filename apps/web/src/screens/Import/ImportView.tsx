import type {
  Import,
  ImportMapping,
  ImportOutcome,
  ImportRow,
  ImportUploadResponse,
} from '@acme/shared';
import { IconAlertCircle, IconCircleCheck, IconFileSpreadsheet } from '@tabler/icons-react';
import { useState } from 'react';
import {
  Confetti,
  ConfirmDialog,
  DataTable,
  Dialog,
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
  onCommit: () => void;
  onStartOver: () => void;
  onUndo: () => void;
  /** Catalogue names and the update currency, to describe each row's changes in words. */
  changeContext: ChangeContext;
}

/**
 * Import from Excel: upload (columns are matched from the headers and the rows checked at once)
 * → review the dry run (the file itself behind a Preview button) → imported, with undo.
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
      {step === 'review' && <ReviewStep {...props} />}
      {step === 'done' && <DoneStep {...props} />}
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
  upload,
  mapping,
  record,
  outcome,
  onOutcomeChange,
  rows,
  onRowsPageChange,
  busy,
  onCommit,
  onStartOver,
  changeContext,
}: ImportViewProps) {
  const [previewing, setPreviewing] = useState(false);
  const summary = record?.summary;
  if (!summary) return null;
  const importable = summary.create + summary.update;
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
            <>
              <PillButton size="small" onClick={() => setPreviewing(true)}>
                Preview file
              </PillButton>
              <PillButton size="small" onClick={onStartOver}>
                Replace file
              </PillButton>
            </>
          }
        />
      )}
      {upload && (
        <Dialog
          open={previewing}
          title={upload.fileName}
          width={960}
          onClose={() => setPreviewing(false)}
          footerNote={
            upload.rowCount > upload.sampleRows.length
              ? `First ${upload.sampleRows.length} of ${formatCount(upload.rowCount)} rows, as they are in your file`
              : `All ${formatCount(upload.rowCount)} ${upload.rowCount === 1 ? 'row' : 'rows'}, as they are in your file`
          }
          actions={<PillButton onClick={() => setPreviewing(false)}>Close</PillButton>}
        >
          <SheetPreview upload={upload} mapping={mapping} />
        </Dialog>
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
        <TrayCard title="Before you import" as="aside">
          <div className={form.form}>
            {summary.error > 0 && (
              <Notice tone="warning">
                {`${formatCount(summary.error)} ${summary.error === 1 ? 'row needs' : 'rows need'} fixing and won't be imported. Fix ${summary.error === 1 ? 'it' : 'them'} in your file, then upload the fixed version to add ${summary.error === 1 ? 'it' : 'them'}.`}
              </Notice>
            )}
            <ul className={styles.facts}>
              <li>Each salary change is added to salary history, so nothing is overwritten.</li>
              <li>You can undo this import until someone edits an employee it changed.</li>
            </ul>
            <PillButton
              tone="primary"
              loading={busy}
              disabled={importable === 0}
              onClick={onCommit}
            >
              {`Import ${formatCount(importable)} rows`}
            </PillButton>
          </div>
        </TrayCard>
      </div>
    </>
  );
}

/** The last step: what was imported, a burst of confetti, undo, and where to go next. */
function DoneStep({ record, busy, onStartOver, onUndo }: ImportViewProps) {
  const [confirmingUndo, setConfirmingUndo] = useState(false);
  const summary = record?.summary;
  if (!summary) return null;
  const undone = record.status === 'undone';
  const imported = summary.create + summary.update;
  return (
    <>
      {!undone && <Confetti />}
      <section className={styles.done} aria-labelledby="import-done">
        <span className={styles.doneIcon} aria-hidden="true">
          <IconCircleCheck size={40} stroke={1.75} />
        </span>
        <h2 id="import-done" className={styles.doneTitle}>
          {undone ? 'Import undone' : `Imported ${formatCount(imported)} rows`}
        </h2>
        <p className={styles.doneText}>
          {undone
            ? 'Every change from this file was reversed. Salary history keeps both entries.'
            : `${record.fileName} is in. Each change is in salary history, and you can undo this import until someone edits an employee it changed.`}
        </p>
        {!undone && (
          <dl className={styles.doneStats}>
            <div>
              <dt>New employees</dt>
              <dd>{formatCount(summary.create)}</dd>
            </div>
            <div>
              <dt>Updated</dt>
              <dd>{formatCount(summary.update)}</dd>
            </div>
            <div>
              <dt>Not imported</dt>
              <dd>{formatCount(summary.error)}</dd>
            </div>
          </dl>
        )}
        {!undone && summary.error > 0 && (
          <p className={`${shared.small} ${shared.muted}`}>
            {summary.error === 1
              ? 'To add the row that needed fixing, fix it in your file and import the fixed version.'
              : `To add the ${formatCount(summary.error)} rows that needed fixing, fix them in your file and import the fixed version.`}
          </p>
        )}
        <div className={styles.doneActions}>
          <PillButton tone="primary" href="/employees">
            Go to Employees
          </PillButton>
          <PillButton onClick={onStartOver}>Import another file</PillButton>
          {record.status === 'committed' && (
            <PillButton tone="danger" onClick={() => setConfirmingUndo(true)} loading={busy}>
              Undo import
            </PillButton>
          )}
        </div>
      </section>
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
