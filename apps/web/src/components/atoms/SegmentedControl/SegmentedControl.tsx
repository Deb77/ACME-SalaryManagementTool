import { SegmentedControl as MantineSegmentedControl } from '@mantine/core';
import styles from './SegmentedControl.module.css';

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
}

export interface SegmentedControlProps<T extends string> {
  /** Accessible name for the group, e.g. "Period" or "Country". */
  label: string;
  options: readonly SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  size?: 'small' | 'medium' | 'large';
}

const MANTINE_SIZE = { small: 'xs', medium: 'sm', large: 'md' } as const;

/** Pill tabs used for period, country and row filters (a single-choice radio group). */
export function SegmentedControl<T extends string>({
  label,
  options,
  value,
  onChange,
  size = 'medium',
}: SegmentedControlProps<T>) {
  return (
    <MantineSegmentedControl
      aria-label={label}
      radius="xl"
      size={MANTINE_SIZE[size]}
      data={options.map((option) => ({ value: option.value, label: option.label }))}
      value={value}
      onChange={(next) => onChange(next as T)}
      classNames={{
        root: styles.root,
        indicator: styles.indicator,
        label: styles.label,
      }}
    />
  );
}
