/** @type {import('@ladle/react').UserConfig} */
export default {
  stories: 'src/**/*.stories.{ts,tsx}',
  // Ladle bundles its own Vite; keep its config separate from the app's Vite config.
  viteConfig: '.ladle/vite.config.ts',
  defaultStory: 'templates--layout--app-shell',
  addons: {
    a11y: { enabled: true },
    // Screens are checked at phone, tablet and desktop widths (docs/ui.md).
    width: {
      enabled: true,
      options: { phone: 375, tablet: 768, desktop: 1440 },
      defaultState: 0,
    },
    theme: { enabled: false },
  },
};
