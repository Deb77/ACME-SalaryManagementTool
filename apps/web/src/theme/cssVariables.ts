import type { CSSProperties } from 'react';
import { colors, fonts, radii, shadows, typeScale } from './tokens';

const kebab = (name: string) => name.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);

/**
 * Exposes the tokens as `--acme-*` custom properties so CSS modules read the
 * same values as the Mantine theme (no hex codes duplicated in CSS).
 */
export function toCssVariables(): CSSProperties {
  const vars: Record<string, string> = {};
  for (const [name, value] of Object.entries(colors)) vars[`--acme-color-${kebab(name)}`] = value;
  for (const [name, value] of Object.entries(radii))
    vars[`--acme-radius-${kebab(name)}`] = `${value}px`;
  for (const [name, value] of Object.entries(shadows)) vars[`--acme-shadow-${kebab(name)}`] = value;
  for (const [name, step] of Object.entries(typeScale)) {
    vars[`--acme-text-${name}`] = `${step.size}rem`;
    vars[`--acme-leading-${name}`] = `${step.lineHeight}rem`;
  }
  vars['--acme-font-sans'] = fonts.sans;
  vars['--acme-font-mono'] = fonts.mono;
  return vars as CSSProperties;
}

/**
 * The same variables as a `:root` rule. They must live on the document root,
 * not on a wrapper element: Mantine portals dialogs, dropdowns and tooltips to
 * `<body>`, outside any wrapper, and they read these variables too.
 */
export function toRootCss(): string {
  const declarations = Object.entries(toCssVariables())
    .map(([name, value]) => `${name}:${String(value)};`)
    .join('');
  return `:root{${declarations}}`;
}
