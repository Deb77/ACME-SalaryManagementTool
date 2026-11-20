import type { ReactNode } from 'react';
import styles from './ChoiceChips.module.css';

export interface ChoiceChip<T extends string> {
  value: T;
  label: string;
  /** Muted text after the label, e.g. a headcount. */
  detail?: ReactNode;
  disabled?: boolean;
}

export interface ChoiceChipsProps<T extends string> {
  /** Fieldset legend, also the group's accessible name. */
  legend: string;
  options: readonly ChoiceChip<T>[];
  value: readonly T[];
  onChange: (value: T[]) => void;
  /** Help or error text under the chips. */
  hint?: ReactNode;
  error?: ReactNode;
  /** Two columns on phones (countries) or one (long permission descriptions). */
  columns?: 1 | 2;
}

/**
 * Multi-select checkboxes drawn as pills (countries for a Country HR user, permissions for a
 * role). Native checkboxes keep keyboard and screen-reader behaviour.
 */
export function ChoiceChips<T extends string>({
  legend,
  options,
  value,
  onChange,
  hint,
  error,
  columns = 2,
}: ChoiceChipsProps<T>) {
  const selected = new Set(value);
  const toggle = (option: T, checked: boolean) =>
    onChange(
      checked
        ? options.map((o) => o.value).filter((v) => v === option || selected.has(v))
        : value.filter((v) => v !== option),
    );
  return (
    <fieldset className={styles.fieldset} aria-invalid={error ? true : undefined}>
      <legend className={styles.legend}>{legend}</legend>
      <div className={`${styles.grid} ${columns === 1 ? styles.one : styles.two}`}>
        {options.map((option) => (
          <label
            key={option.value}
            className={styles.chip}
            data-checked={selected.has(option.value) || undefined}
            data-disabled={option.disabled || undefined}
          >
            <input
              type="checkbox"
              className={styles.input}
              checked={selected.has(option.value)}
              disabled={option.disabled}
              onChange={(event) => toggle(option.value, event.currentTarget.checked)}
            />
            <span className={styles.label}>{option.label}</span>
            {option.detail !== undefined && <span className={styles.detail}>{option.detail}</span>}
          </label>
        ))}
      </div>
      {(error ?? hint) && <p className={error ? styles.error : styles.hint}>{error ?? hint}</p>}
    </fieldset>
  );
}
