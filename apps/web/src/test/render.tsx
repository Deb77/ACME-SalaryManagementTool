/* eslint-disable react-refresh/only-export-components -- test helper, not a component module */
import { render as rtlRender, type RenderOptions } from '@testing-library/react';
import type { ReactElement } from 'react';
import { ThemeProvider } from '../theme/ThemeProvider';

export * from '@testing-library/react';

/**
 * Testing Library's render inside the app theme. Mantine components need
 * their provider; `env="test"` turns off transitions and portals.
 */
export function render(ui: ReactElement, options?: Omit<RenderOptions, 'wrapper'>) {
  return rtlRender(ui, {
    wrapper: ({ children }) => <ThemeProvider env="test">{children}</ThemeProvider>,
    ...options,
  });
}
