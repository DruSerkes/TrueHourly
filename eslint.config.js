import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import prettier from 'eslint-config-prettier';
export default tseslint.config(
  { ignores: ['dist', 'node_modules', 'coverage'] },
  {
    files: ['**/*.{ts,tsx}'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended, prettier],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      // CLAUDE.md: named exports only, outside App.tsx.
      'no-restricted-exports': ['error', { restrictDefaultExports: { direct: true } }],
    },
  },
  {
    // App.tsx is the one sanctioned default export in src/; config files must
    // default-export to satisfy their own tooling contracts.
    files: ['src/App.tsx', '*.config.ts', '*.config.js'],
    rules: { 'no-restricted-exports': 'off' },
  },
  {
    files: ['src/engine/**/*.ts'],
    ignores: ['src/engine/__tests__/**'],
    rules: {
      // Invariant 1: the engine is pure. This is a fast-feedback backstop; the
      // load-bearing check is src/engine/__tests__/purity.test.ts.
      'no-restricted-globals': [
        'error',
        'window',
        'document',
        'localStorage',
        'sessionStorage',
        'fetch',
        'navigator',
      ],
      'no-restricted-imports': ['error', { patterns: ['react', 'react-dom', 'react/*'] }],
    },
  },
  {
    files: ['src/**/__tests__/**/*.ts', 'src/**/__tests__/**/*.tsx'],
    languageOptions: { globals: globals.node },
  },
  {
    files: ['*.config.js', '*.config.ts'],
    languageOptions: { globals: globals.node },
  }
);
