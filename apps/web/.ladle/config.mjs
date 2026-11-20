/** @type {import('@ladle/react').UserConfig} */
export default {
  stories: 'src/**/*.stories.{ts,tsx}',
  // Ladle bundles its own Vite; keep its config separate from the app's Vite config.
  viteConfig: '.ladle/vite.config.ts',
  defaultStory: 'templates--layout--app-shell',
  addons: {
    a11y: { enabled: true },
    width: { enabled: true },
    theme: { enabled: false },
  },
};
