import { CloseButton, TextInput } from '@mantine/core';
import { IconSearch } from '@tabler/icons-react';
import styles from './SearchField.module.css';

export interface SearchFieldProps {
  /** Accessible name; the placeholder is only a hint. */
  label: string;
  placeholder?: string;
  value: string;
  onChange: (value: string) => void;
  width?: number | string;
}

/**
 * Pill search input. Controlled and presentational: debouncing and the
 * request itself belong to the screen that owns the query.
 */
export function SearchField({
  label,
  placeholder,
  value,
  onChange,
  width = 340,
}: SearchFieldProps) {
  return (
    <TextInput
      type="search"
      aria-label={label}
      placeholder={placeholder}
      leftSection={<IconSearch aria-hidden="true" size={16} />}
      rightSection={
        value ? (
          <CloseButton
            className={styles.clear}
            aria-label="Clear search"
            onClick={() => onChange('')}
          />
        ) : null
      }
      rightSectionWidth={44}
      value={value}
      onChange={(event) => onChange(event.currentTarget.value)}
      w={width}
      maw="100%"
      classNames={{ input: styles.input }}
    />
  );
}
