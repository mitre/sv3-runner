import js from '@eslint/js';
import globals from 'globals';
import eslintConfigPrettier from 'eslint-config-prettier/flat';

// Flat config for a plain Node.js ESM project (no TypeScript).
// eslint-config-prettier is last so it disables any stylistic rules that
// would conflict with Prettier — ESLint handles code quality, Prettier handles
// formatting (kept as separate tools, both run by `npm run lint`).
export default [
  {
    ignores: ['node_modules/**', 'sv3-app/**', 'downloads/**'],
  },
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: {
        ...globals.node,
      },
    },
  },
  eslintConfigPrettier,
];
