import type { GlobalProvider } from '@ladle/react';
import { ThemeProvider } from '../src/theme';
import '../src/theme/fonts';

/** Every story renders inside the app's Mantine theme, fonts and CSS variables. */
export const Provider: GlobalProvider = ({ children }) => (
  <ThemeProvider>
    <div style={{ padding: 24 }}>{children}</div>
  </ThemeProvider>
);
