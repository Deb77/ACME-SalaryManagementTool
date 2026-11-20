import { useId, type ReactNode } from 'react';
import styles from './FormField.module.css';

/** Props to spread onto the control so label, hint and error are linked to it. */
export interface FieldControlProps {
  id: string;
  'aria-describedby'?: string;
  'aria-invalid'?: boolean;
}

export interface FormFieldProps {
  label: ReactNode;
  /** Help text under the control; replaced by the error when there is one. */
  hint?: ReactNode;
  error?: ReactNode;
  optional?: boolean;
  required?: boolean;
  children: (control: FieldControlProps) => ReactNode;
}

/**
 * Label + control + hint/error. Children are a render function so any control
 * (TextInput, Select, MoneyInput) gets the id and aria wiring; validation
 * itself lives in the screen's form logic.
 */
export function FormField({ label, hint, error, optional, required, children }: FormFieldProps) {
  const id = useId();
  const messageId = `${id}-message`;
  const message = error ?? hint;
  return (
    <div className={styles.field}>
      <label htmlFor={id} className={styles.label}>
        {label}
        {required && (
          <span aria-hidden="true" className={styles.required}>
            {' '}
            *
          </span>
        )}
        {optional && <span className={styles.optional}>&nbsp;(optional)</span>}
      </label>
      {children({
        id,
        'aria-describedby': message ? messageId : undefined,
        'aria-invalid': error ? true : undefined,
      })}
      {message && (
        <span id={messageId} className={error ? styles.error : styles.hint}>
          {message}
        </span>
      )}
    </div>
  );
}
