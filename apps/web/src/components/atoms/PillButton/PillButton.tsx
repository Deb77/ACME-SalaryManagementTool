import { Button } from '@mantine/core';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { AppLink } from '../AppLink/AppLink';
import styles from './PillButton.module.css';

export type PillButtonTone = 'primary' | 'secondary' | 'quiet' | 'danger';

export interface PillButtonProps extends Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  'color' | 'type'
> {
  /**
   * primary: the one main action on a screen (green, solid).
   * secondary: other actions (white, outlined).
   * quiet: low-emphasis text actions such as "Clear filters".
   * danger: destructive actions such as "Terminate".
   */
  tone?: PillButtonTone;
  /** Icon before the text. */
  icon?: ReactNode;
  size?: 'small' | 'medium';
  /** Shows a spinner and blocks presses. */
  loading?: boolean;
  type?: 'button' | 'submit' | 'reset';
  /** Renders a link styled as this button (navigation, downloads). */
  href?: string;
  /** With `href`: download the target instead of navigating (CSV export, templates). */
  download?: boolean | string;
  children: ReactNode;
}

/** Mantine Button restricted to the four button styles in the designs, always pill-shaped. */
export function PillButton({
  tone = 'secondary',
  icon,
  size = 'medium',
  loading = false,
  type = 'button',
  className,
  href,
  download,
  children,
  ...rest
}: PillButtonProps) {
  const classes = [styles.button, styles[tone], styles[size], className].filter(Boolean).join(' ');
  if (href) {
    return (
      <Button
        component={AppLink}
        href={href}
        download={download}
        leftSection={icon}
        variant="default"
        className={classes}
        aria-label={rest['aria-label']}
      >
        {children}
      </Button>
    );
  }
  return (
    <Button
      type={type}
      loading={loading}
      leftSection={icon}
      variant="default"
      className={classes}
      {...rest}
    >
      {children}
    </Button>
  );
}
