// frontend/eslint.config.js

import js from '@eslint/js';
import pluginQuery from '@tanstack/eslint-plugin-query';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import { defineConfig, globalIgnores } from 'eslint/config';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      // rules of hooks, exhaustive deps, and the react compiler correctness rules
      reactHooks.configs.flat.recommended,
      // files exporting components must export only components, or hmr falls back to a full reload
      reactRefresh.configs.vite,
      // query keys must include every variable the query function uses
      pluginQuery.configs['flat/recommended'],
    ],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.browser,
    },
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' }],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      // the shadcn cli (4.21+) writes cn imports from the cn package instead of from the
      // utils. two merge implementations would resolve class conflicts differently, so a
      // generated file must be pointed back at @/lib/utils before it is committed
      'no-restricted-imports': ['error', {
        paths: [{ name: 'cn', message: 'Import cn from @/lib/utils. The shadcn CLI writes this import; fix it after each add.' }],
      }],
    },
  },
  {
    // generated shadcn files export variant helpers (buttonvariants) next to components by design
    files: ['src/components/ui/**'],
    rules: { 'react-refresh/only-export-components': 'off' },
  },
]);