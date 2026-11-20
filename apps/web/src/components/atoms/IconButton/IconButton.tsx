import { UnstyledButton } from '@mantine/core';
import type { ReactNode } from 'react';
import { AppLink } from '../AppLink/AppLink';
import styles from './IconButton.module.css';

export interface IconButtonProps {
  /** Accessible name; the icon itself is hidden from assistive technology. */
  label: string;
  icon: ReactNode;
  /** Renders a link instead of a button. */
  href?: string;
  onClick?: () => void;
  disabled?: boolean;
  /** `filled` is the round grey avatar-style button. */
  tone?: 'outline' | 'filled';
}

/** Round 44px icon-only control used in the phone header and on list rows. */
export function IconButton({
  label,
  icon,
  href,
  onClick,
  disabled,
  tone = 'outline',
}: IconButtonProps) {
  const className = `${styles.button} ${styles[tone]}`;
  const content = <span aria-hidden="true">{icon}</span>;
  if (href && !disabled) {
    return (
      <AppLink href={href} className={className} aria-label={label} title={label}>
        {content}
      </AppLink>
    );
  }
  return (
    <UnstyledButton
      type="button"
      className={className}
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
    >
      {content}
    </UnstyledButton>
  );
}
