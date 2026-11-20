import { UnstyledButton } from '@mantine/core';
import { IconArrowUp } from '@tabler/icons-react';
import { useId, type ReactNode } from 'react';
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

/** The Ask AI question box: a labelled input, a round send button and a caveat underneath. */
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
  return (
    <form
      className={styles.form}
      onSubmit={(event) => {
        event.preventDefault();
        if (canSend) onSubmit(value.trim());
      }}
    >
      <div className={styles.box}>
        <div className={styles.root}>
          <label htmlFor={inputId} className={styles.label}>
            {label}
          </label>
          <input
            id={inputId}
            className={styles.input}
            placeholder={placeholder}
            value={value}
            disabled={disabled}
            maxLength={2000}
            autoComplete="off"
            aria-describedby={hint ? hintId : undefined}
            onChange={(event) => onChange(event.currentTarget.value)}
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
