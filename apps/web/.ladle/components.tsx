import type { GlobalProvider } from '@ladle/react';
import { ThemeProvider } from '../src/theme';
import '../src/theme/fonts';

/**
 * Every story renders inside the app's Mantine theme, fonts and CSS variables. Screen
 * stories set `meta = { fullscreen: true }` so the app frame fills the viewport.
 */
export const Provider: GlobalProvider = ({ children, storyMeta }) => (
  <ThemeProvider>
    {storyMeta?.fullscreen ? children : <div style={{ padding: 24 }}>{children}</div>}
  </ThemeProvider>
);
