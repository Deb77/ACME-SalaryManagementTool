import '@mantine/core/styles.layer.css';
import { MantineProvider } from '@mantine/core';
import type { ReactNode } from 'react';
import { toRootCss } from './cssVariables';
import { mantineTheme } from './mantineTheme';
import './global.css';

const rootCss = toRootCss();

/**
 * Applies the ACME theme: Mantine's provider plus our `--acme-*` CSS
 * variables on `:root`, so that portalled content (dialogs, dropdowns) sees
 * them too. Mantine's CSS is loaded as `@layer mantine`, so any CSS module
 * rule beats it without `!important`.
 */
export function ThemeProvider({
  children,
  env,
}: {
  children: ReactNode;
  /** "test" turns off Mantine's transitions and portals for jsdom. */
  env?: 'default' | 'test';
}) {
  return (
    <MantineProvider theme={mantineTheme} env={env}>
      {/* React 19 hoists this into <head> and renders it once. */}
      <style href="acme-tokens" precedence="default">
        {rootCss}
      </style>
      <div className="acme-root">{children}</div>
    </MantineProvider>
  );
}
