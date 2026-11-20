/**
 * Design tokens taken from the "ACME Salary Management – UI Design" canvas.
 *
 * This file is the single source of truth for colour, radius, type and shadow.
 * `mantineTheme.ts` maps colours, fonts and radii into Mantine's theme, and
 * `cssVariables.ts` exposes everything as `--acme-*` custom properties for the
 * CSS modules that style every component.
 */

export const colors = {
  accent: '#2E6B47',
  accentHover: '#1F4D32',
  accentStrong: '#1B4A31',
  green500: '#3FA266',
  green300: '#9FD3B0',
  green200: '#CBE7D4',
  green100: '#EEF7F1',
  green50: '#F3FAF5',
  successText: '#23703D',
  successDot: '#2FA35A',

  grey900: '#111111',
  grey800: '#222222',
  grey700: '#333333',
  grey600: '#555555',
  grey500: '#666666',
  grey400: '#8A8A8A',
  grey300: '#DADADA',
  grey200: '#E4E4E4',
  grey150: '#EBEBEB',
  grey100: '#F0F0F0',
  grey50: '#F4F4F4',
  white: '#FFFFFF',

  frame: '#F1F2F1',
  danger: '#C0362C',
  dangerText: '#B42318',
  dangerBg: '#FDF1F0',
  warning: '#B26B00',
  warningBg: '#FFF6E5',
} as const;

export const radii = {
  sm: 8,
  md: 12,
  /** White panel inside a tray card. */
  lg: 14,
  /** Tray cards. */
  xl: 18,
  /** App content panel and dialogs. */
  xxl: 22,
  pill: 999,
} as const;

export const fonts = {
  sans: "'Geist Sans', Geist, Inter, system-ui, -apple-system, 'Segoe UI', sans-serif",
  mono: "'Geist Mono', ui-monospace, SFMono-Regular, Menlo, monospace",
} as const;

export const shadows = {
  panel: '0 1px 2px rgba(16,16,16,0.04), 0 10px 28px -14px rgba(16,16,16,0.12)',
  frame: '0 1px 3px rgba(16,16,16,0.04), 0 30px 70px -36px rgba(16,40,24,0.25)',
  button: '0 1px 2px rgba(16,16,16,0.05)',
  primaryButton:
    'inset 0 1px 0 rgba(255,255,255,0.25), 0 1px 2px rgba(16,16,16,0.2), 0 8px 18px -6px rgba(46,107,71,0.55)',
  dialog: '0 24px 48px -12px rgba(16,16,16,0.18)',
  focus: '0 0 0 4px rgba(46,107,71,0.10)',
} as const;

export const sizes = {
  /** Buttons and inputs: 44–46px keeps every target at least 44px tall. */
  control: 44,
  controlSm: 36,
  controlLg: 46,
} as const;

/** Categorical/sequential colours for charts, all from the green ramp plus a neutral. */
export const chartColors = {
  line: colors.accent,
  areaFrom: colors.green500,
  bar: colors.green500,
  barMuted: colors.green300,
  highlight: colors.accent,
  grid: colors.grey100,
  axis: colors.grey500,
} as const;
