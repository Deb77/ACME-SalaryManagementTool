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
  // Sized to its own text, like a chip, instead of Mantine's default input width.
  const shown = options.find((option) => option.value === value)?.label ?? allLabel;
  const prefixWidth = label.length * 7.5 + 24;
  const width = Math.min(prefixWidth + shown.length * 8 + (value ? 64 : 40), 280);
  return (
    <Select
      aria-label={label}
      leftSection={<span className={styles.prefix}>{label}</span>}
      // The section is absolutely positioned, so it needs a width: about 7.5px a letter.
      leftSectionWidth={prefixWidth}
      leftSectionPointerEvents="none"
      placeholder={allLabel}
      clearable
      clearButtonProps={{ className: styles.clear }}
      rightSectionWidth={value ? 56 : 32}
      w={width}
      allowDeselect
      data={options.map((option) => ({ value: option.value, label: option.label }))}
      value={value ?? null}
      onChange={(next) => onChange(next ?? undefined)}
      comboboxProps={{ width: 'max-content', position: 'bottom-start' }}
      classNames={{ root: styles.root, input: styles.input, option: styles.option }}
    />
  );
}
