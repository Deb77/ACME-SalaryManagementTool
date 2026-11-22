import { useId } from 'react';

export interface LogoProps {
  /** Width and height in px. */
  size?: number;
  className?: string;
}

/**
 * The ACME People mark: an "A" on the green tile, its crossbar a rising line that ends in a
 * dot (pay going up, and a person). Decorative: the product name always sits beside it, so it
 * is hidden from assistive technology. public/favicon.svg and the boot splash in index.html
 * draw the same shape, so keep them in step.
 */
export function Logo({ size = 32, className }: LogoProps) {
  const gradient = useId();
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      aria-hidden="true"
      focusable="false"
      className={className}
      data-testid="logo"
    >
      <defs>
        <linearGradient id={gradient} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#5DB27F" />
          <stop offset="0.62" stopColor="#2E6B47" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="9" fill={`url(#${gradient})`} />
      <path
        d="M7.5 24 L14 8.5 L20.5 24"
        fill="none"
        stroke="#FFFFFF"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M9.6 19.6 L19.4 15.7"
        fill="none"
        stroke="#FFFFFF"
        strokeWidth="2.6"
        strokeLinecap="round"
      />
      <circle cx="24" cy="13.5" r="2.2" fill="#CBE7D4" />
    </svg>
  );
}
