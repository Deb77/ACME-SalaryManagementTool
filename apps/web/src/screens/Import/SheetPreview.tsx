import type { ImportField, ImportMapping, ImportUploadResponse } from '@acme/shared';
import { formatCount } from '../../lib/format';
import styles from './Import.module.css';
import { columnLetter, IMPORT_FIELD_LABELS } from './Import.utils';

export interface SheetPreviewProps {
  upload: ImportUploadResponse;
  /** The current matches, so each column says which field it fills (or that it is skipped). */
  mapping: ImportMapping;
}

/**
 * The first rows of the uploaded sheet as they are in the file, laid out like a spreadsheet
 * (column letters, Excel row numbers). Each header shows the field it is matched to, and
 * updates as the matches change, so people can check the guess against real values.
 */
export function SheetPreview({ upload, mapping }: SheetPreviewProps) {
  const fieldFor = new Map<string, ImportField>();
  for (const [field, column] of Object.entries(mapping) as [ImportField, string][]) {
    fieldFor.set(column, field);
  }
  const shown = upload.sampleRows.length;
  return (
    <div className={styles.previewBlock}>
      <div className={styles.previewScroll} tabIndex={0} role="region" aria-label="Sheet preview">
        <table className={styles.preview}>
          <caption className="visually-hidden">
            First {shown} of {formatCount(upload.rowCount)} rows in {upload.fileName}
          </caption>
          <thead>
            <tr className={styles.previewLetters} aria-hidden="true">
              <th className={styles.previewCorner} />
              {upload.columns.map((column, index) => (
                <th key={column}>{columnLetter(index)}</th>
              ))}
            </tr>
            <tr>
              <th className={styles.previewCorner} scope="col">
                <span className="visually-hidden">Row </span>1
              </th>
              {upload.columns.map((column) => {
                const field = fieldFor.get(column);
                return (
                  <th key={column} scope="col" data-unmatched={field ? undefined : true}>
                    <span className={styles.previewColumn}>{column}</span>{' '}
                    <span className={styles.previewField}>
                      {field ? `→ ${IMPORT_FIELD_LABELS[field]}` : 'Not imported'}
                    </span>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {upload.sampleRows.map((row, rowIndex) => (
              <tr key={rowIndex}>
                {/* Row 1 is the header, so the first data row is row 2, as in Excel. */}
                <th scope="row" className={styles.previewRowNumber}>
                  {rowIndex + 2}
                </th>
                {upload.columns.map((column, columnIndex) => (
                  <td key={column} data-unmatched={fieldFor.has(column) ? undefined : true}>
                    {row[columnIndex] ?? ''}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {shown === 0 && <p className={styles.previewEmpty}>The sheet has headers but no rows.</p>}
    </div>
  );
}
