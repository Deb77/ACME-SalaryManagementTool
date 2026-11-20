import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import prettier from 'eslint-config-prettier';
import globals from 'globals';

export default tseslint.config(
  { ignores: ['**/dist/**', '**/coverage/**', 'apps/web/build/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: { globals: { ...globals.node } },
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
  {
    files: ['apps/web/**/*.{ts,tsx}'],
    languageOptions: { globals: { ...globals.browser } },
    plugins: { 'react-hooks': reactHooks, 'react-refresh': reactRefresh },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    },
  },
  // Atomic design: a component level may only import from lower levels.
  ...atomicLevelRules(),
  prettier,
);

function atomicLevelRules() {
  const levels = ['atoms', 'molecules', 'organisms', 'templates'];
  return levels.slice(0, -1).map((level, index) => {
    const higher = levels.slice(index + 1);
    return {
      files: [`apps/web/src/components/${level}/**/*.{ts,tsx}`],
      rules: {
        'no-restricted-imports': [
          'error',
          {
            patterns: [
              {
                group: higher.map((name) => `**/${name}/**`),
                message: `${level} may only import from lower atomic levels (${levels.slice(0, index).join(', ') || 'none'}).`,
              },
            ],
          },
        ],
      },
    };
  });
}
