import { IconFileSpreadsheet } from '@tabler/icons-react';
import { useRef, useState, type ReactNode } from 'react';
import { hasAcceptedExtension } from './FileDropzone.utils';
import styles from './FileDropzone.module.css';

export type FileRejection = 'type' | 'size';

export interface FileDropzoneProps {
  /** Comma-separated extensions, as for <input accept>. */
  accept?: string;
  maxSizeBytes?: number;
  hint?: ReactNode;
  disabled?: boolean;
  onFileSelected: (file: File) => void;
  onFileRejected?: (file: File, reason: FileRejection) => void;
}

const DEFAULT_ACCEPT = '.xlsx,.csv';
const MB = 1024 * 1024;

/**
 * Drag-and-drop or click-to-browse file picker. It never uploads by itself:
 * it hands the File to the parent, which owns parsing and the request.
 * The drop area is a button (Enter or Space opens the file picker).
 */
export function FileDropzone({
  accept = DEFAULT_ACCEPT,
  maxSizeBytes = 10 * MB,
  hint,
  disabled = false,
  onFileSelected,
  onFileRejected,
}: FileDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const handle = (file: File | undefined) => {
    if (!file) return;
    if (!hasAcceptedExtension(file.name, accept)) onFileRejected?.(file, 'type');
    else if (file.size > maxSizeBytes) onFileRejected?.(file, 'size');
    else onFileSelected(file);
  };

  const open = () => {
    if (!disabled) inputRef.current?.click();
  };

  return (
    <div
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-disabled={disabled || undefined}
      className={styles.zone}
      data-dragging={dragging || undefined}
      onClick={open}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          open();
        }
      }}
      onDragOver={(event) => {
        event.preventDefault();
        if (!disabled) setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
        if (!disabled) handle(event.dataTransfer.files[0]);
      }}
    >
      <IconFileSpreadsheet aria-hidden="true" className={styles.icon} size={36} stroke={1.5} />
      <span className={styles.text}>Drop your Excel or CSV file here, or click to browse</span>
      <span className={styles.hint}>
        {hint ?? `${accept.replaceAll(',', ', ')} up to ${Math.round(maxSizeBytes / MB)} MB`}
      </span>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        hidden
        tabIndex={-1}
        disabled={disabled}
        onChange={(event) => {
          handle(event.currentTarget.files?.[0]);
          // Allow choosing the same file again after a rejection.
          event.currentTarget.value = '';
        }}
      />
    </div>
  );
}
