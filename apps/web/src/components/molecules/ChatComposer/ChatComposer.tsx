import { UnstyledButton } from '@mantine/core';
import { IconArrowUp } from '@tabler/icons-react';
import { useId, useLayoutEffect, useRef, type ReactNode } from 'react';
import styles from './ChatComposer.module.css';

export interface ChatComposerProps {
  label?: string;
  placeholder?: string;
  value: string;
  onChange: (value: string) => void;
  onSubmit: (message: string) => void;
  /** While an answer streams the input stays editable but cannot be sent. */
  busy?: boolean;
  disabled?: boolean;
  hint?: ReactNode;
}

/** Lines the question box grows to before it scrolls. */
const MAX_LINES = 5;

/**
 * The Ask AI question box: a labelled text area that grows with the question (Enter sends,
 * Shift+Enter starts a new line), a round send button and a caveat underneath.
 */
export function ChatComposer({
  label = 'Ask a question about pay',
  placeholder = 'Ask a follow-up…',
  value,
  onChange,
  onSubmit,
  busy = false,
  disabled = false,
  hint,
}: ChatComposerProps) {
  const inputId = useId();
  const hintId = `${inputId}-hint`;
  const canSend = value.trim().length > 0 && !busy && !disabled;
  const input = useRef<HTMLTextAreaElement>(null);

  // Grow with the text up to MAX_LINES, then scroll inside the box.
  useLayoutEffect(() => {
    const element = input.current;
    if (!element) return;
    element.style.height = 'auto';
    const lineHeight = parseFloat(getComputedStyle(element).lineHeight) || 24;
    element.style.height = `${Math.min(element.scrollHeight, lineHeight * MAX_LINES)}px`;
  }, [value]);

  const send = () => {
    if (canSend) onSubmit(value.trim());
  };
  return (
    <form
      className={styles.form}
      onSubmit={(event) => {
        event.preventDefault();
        send();
      }}
    >
      <div className={styles.box}>
        <div className={styles.root}>
          <label htmlFor={inputId} className={styles.label}>
            {label}
          </label>
          <textarea
            ref={input}
            id={inputId}
            className={styles.input}
            placeholder={placeholder}
            value={value}
            disabled={disabled}
            maxLength={2000}
            rows={1}
            autoComplete="off"
            enterKeyHint="send"
            aria-describedby={hint ? hintId : undefined}
            onChange={(event) => onChange(event.currentTarget.value)}
            onKeyDown={(event) => {
              // Enter sends; Shift+Enter (and Enter while composing CJK text) types a new line.
              if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
                event.preventDefault();
                send();
              }
            }}
          />
        </div>
        <UnstyledButton
          type="submit"
          className={styles.send}
          aria-label="Send question"
          disabled={!canSend}
        >
          <IconArrowUp aria-hidden="true" size={20} stroke={2.2} />
        </UnstyledButton>
      </div>
      {hint && (
        <p id={hintId} className={styles.hint}>
          {hint}
        </p>
      )}
    </form>
  );
}
