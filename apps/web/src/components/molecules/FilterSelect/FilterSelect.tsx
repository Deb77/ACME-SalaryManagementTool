import { Select } from '@mantine/core';
import styles from './FilterSelect.module.css';

export interface FilterOption {
  value: string;
  label: string;
}

export interface FilterSelectProps {
  /** Shown inside the pill before the value, and used as the accessible name. */
  label: string;
  options: readonly FilterOption[];
  /** `undefined` means "All". */
  value: string | undefined;
  onChange: (value: string | undefined) => void;
  allLabel?: string;
}

/** A pill-shaped filter ("Country: India") used above tables. */
export function FilterSelect({
  label,
  options,
  value,
  onChange,
  allLabel = 'All',
}: FilterSelectProps) {
  return (
    <Select
      aria-label={label}
      leftSection={<span className={styles.prefix}>{label}</span>}
      // The section is absolutely positioned, so it needs a width: about 7.5px a letter.
      leftSectionWidth={label.length * 7.5 + 24}
      leftSectionPointerEvents="none"
      placeholder={allLabel}
      clearable
      allowDeselect
      data={options.map((option) => ({ value: option.value, label: option.label }))}
      value={value ?? null}
      onChange={(next) => onChange(next ?? undefined)}
      comboboxProps={{ width: 'max-content', position: 'bottom-start' }}
      classNames={{ root: styles.root, input: styles.input, option: styles.option }}
    />
  );
}
