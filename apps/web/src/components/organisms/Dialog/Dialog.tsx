import { Modal } from '@mantine/core';
import { useCallback, useLayoutEffect, useRef, type ReactNode } from 'react';
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

const FIELD_SELECTOR = 'input:not([type="hidden"]), select, textarea';

/** The first enabled form field in the panel; for a radio group, its checked option. */
function firstField(panel: HTMLElement): HTMLElement | undefined {
  const field = Array.from(panel.querySelectorAll<HTMLElement>(FIELD_SELECTOR)).find(
    (el) => !el.matches(':disabled'),
  );
  if (field instanceof HTMLInputElement && field.type === 'radio' && !field.checked) {
    const checked = Array.from(
      panel.querySelectorAll<HTMLInputElement>('input[type="radio"]:checked'),
    ).find((radio) => radio.name === field.name && !radio.disabled);
    return checked ?? field;
  }
  return field;
}

/**
 * Mantine returns focus only when `opened` turns false, but screens render dialogs only while
 * open, so the Modal often unmounts instead. The Dialog remembers the element that opened it
 * and puts focus back there when it closes or unmounts, unless focus had already been moved
 * out of the dialog on purpose. Returns the ref callback for the dialog's panel.
 */
function useDialogFocus(open: boolean) {
  const opener = useRef<HTMLElement | null>(null);
  const contentRef = useRef<Element | null>(null);
  const pending = useRef<number | undefined>(undefined);

  useLayoutEffect(() => {
    if (!open) return;
    // A restore scheduled by a cleanup that React immediately re-runs (StrictMode) is dropped.
    window.clearTimeout(pending.current);
    const active = document.activeElement;
    if (active instanceof HTMLElement && active !== document.body) opener.current = active;
    return () => {
      const target = opener.current;
      const atClose = document.activeElement;
      // Read at close on purpose: the content node may mount after this effect (transitions).
      const content = contentRef.current;
      const focusInDialog =
        atClose === null || atClose === document.body || !!content?.contains(atClose);
      if (!target || !focusInDialog) return;
      pending.current = window.setTimeout(() => {
        const now = document.activeElement;
        const untouched =
          now === null || now === document.body || now === atClose || !now.isConnected;
        if (target.isConnected && untouched) target.focus({ preventScroll: true });
      });
    };
  }, [open]);

  // Mantine's focus trap focuses `[data-autofocus]` first; it looks after this ref has run.
  return useCallback((panel: HTMLDivElement | null) => {
    if (!panel) return;
    contentRef.current = panel.closest('[role="dialog"]') ?? panel;
    if (panel.querySelector('[data-autofocus]')) return;
    firstField(panel)?.setAttribute('data-autofocus', '');
  }, []);
}

/**
 * Mantine Modal in the tray style: uppercase title, white body panel and a
 * footer strip. Every part is styled by one CSS module through `classNames`.
 * Mantine handles focus trapping and Esc; the Dialog starts focus on the first form field (else
 * Mantine's default, the close button) and returns it to the opener. On phones it is a
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
  const panelRef = useDialogFocus(open);

  return (
    <Modal
      opened={open}
      onClose={onClose}
      title={title}
      size={width}
      centered
      returnFocus={false}
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
      <div ref={panelRef} className={styles.panel}>
        {children}
      </div>
      {(footerNote || actions) && (
        <div className={styles.footer}>
          {footerNote && <span className={styles.note}>{footerNote}</span>}
          {actions && <div className={styles.actions}>{actions}</div>}
        </div>
      )}
    </Modal>
  );
}
