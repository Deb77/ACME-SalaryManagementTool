import { Select } from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import type { CSSProperties } from 'react';
import { mediaQueries } from '../../../theme/tokens';
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

const MIN_DROPDOWN_PX = 160;

/**
 * A pill-shaped filter used above tables. From tablet it reads "Country · India". On phones, where
 * two pills share a row, it shows just the name ("Country") until a value is chosen, then just the
 * value ("India", tinted, with an ×), so neither is cut off.
 */
export function FilterSelect({
  label,
  options,
  value,
  onChange,
  allLabel = 'All',
}: FilterSelectProps) {
  const roomy = useMediaQuery(mediaQueries.tablet);
  // From tablet it is sized to its own text, like a chip (14px text, about 8px a letter); on
  // phones it fills its grid cell instead, so 16px text never runs under the × or the chevron.
  const shown = options.find((option) => option.value === value)?.label ?? allLabel;
  const prefixWidth = label.length * 7.5 + 24;
  const width = Math.min(prefixWidth + shown.length * 8 + (value ? 52 : 40), 280);
  return (
    <Select
      aria-label={label}
      leftSection={roomy ? <span className={styles.prefix}>{label}</span> : undefined}
      // The section is absolutely positioned, so it needs a width: about 7.5px a letter.
      leftSectionWidth={roomy ? prefixWidth : undefined}
      leftSectionPointerEvents="none"
      placeholder={roomy ? allLabel : label}
      data-active={value !== undefined || undefined}
      clearable
      // With a value the × replaces the chevron instead of sitting beside it, where the 44px
      // phone target overlapped it; the whole pill still opens the list.
      clearSectionMode="clear"
      clearButtonProps={{ className: styles.clear, 'aria-label': `Clear ${label}` }}
      rightSectionWidth={value ? 44 : 32}
      style={{ '--filter-width': `${width}px` } as CSSProperties}
      allowDeselect
      // The tick sits at the end, so the chosen option's name lines up with the others.
      checkIconPosition="right"
      data={options.map((option) => ({ value: option.value, label: option.label }))}
      value={value ?? null}
      onChange={(next) => onChange(next ?? undefined)}
      // Sized to the longest option, but never narrower than the pill (from tablet, where its
      // width is known) or 160px, so a list of short codes isn't a sliver.
      comboboxProps={{ width: 'max-content', position: 'bottom-start' }}
      styles={{
        dropdown: { minWidth: roomy ? Math.max(width, MIN_DROPDOWN_PX) : MIN_DROPDOWN_PX },
      }}
      classNames={{
        root: styles.root,
        input: styles.input,
        option: styles.option,
        dropdown: styles.dropdown,
      }}
    />
  );
}
