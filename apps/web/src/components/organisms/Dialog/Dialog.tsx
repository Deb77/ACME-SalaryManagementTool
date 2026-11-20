import { Modal } from '@mantine/core';
import type { ReactNode } from 'react';
import styles from './Dialog.module.css';

export interface DialogProps {
  open: boolean;
  title: ReactNode;
  onClose: () => void;
  children: ReactNode;
  /** Muted text left of the actions, e.g. "Saved changes are permanent". */
  footerNote?: ReactNode;
  /** Buttons, primary last. */
  actions?: ReactNode;
  width?: number;
  /** Prevent closing (Esc, overlay, close button) while saving. */
  busy?: boolean;
}

/**
 * Mantine Modal in the tray style: uppercase title, white body panel and a
 * footer strip. Every part is styled by one CSS module through `classNames`.
 * Mantine handles focus trapping, Esc and restoring focus. On phones it is a
 * bottom sheet with full-width actions; from tablet width a centred dialog.
 */
export function Dialog({
  open,
  title,
  onClose,
  children,
  footerNote,
  actions,
  width = 560,
  busy = false,
}: DialogProps) {
  return (
    <Modal
      opened={open}
      onClose={onClose}
      title={title}
      size={width}
      centered
      withCloseButton={!busy}
      closeOnEscape={!busy}
      closeOnClickOutside={!busy}
      closeButtonProps={{ 'aria-label': 'Close' }}
      classNames={{
        inner: styles.inner,
        content: styles.content,
        header: styles.header,
        title: styles.title,
        body: styles.body,
        close: styles.close,
      }}
    >
      <div className={styles.panel}>{children}</div>
      {(footerNote || actions) && (
        <div className={styles.footer}>
          {footerNote && <span className={styles.note}>{footerNote}</span>}
          {actions && <div className={styles.actions}>{actions}</div>}
        </div>
      )}
    </Modal>
  );
}
