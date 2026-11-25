// @ts-check
import eslint from '@eslint/js';
import prettier from 'eslint-config-prettier';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import globals from 'globals';
import tseslint from 'typescript-eslint';

/** Same rules as apps/api (RULE.md §2) plus React rules (spec §2, ADR-0034). */
export default tseslint.config(
  { ignores: ['dist/**', 'coverage/**', 'src/api/generated/**', 'eslint.config.js'] },
  eslint.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  reactHooks.configs.flat['recommended-latest'],
  reactRefresh.configs.vite,
  jsxA11y.flatConfigs.recommended,
  prettier,
  {
    languageOptions: {
      globals: globals.browser,
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      // RULE.md §2 — TypeScript
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-non-null-assertion': 'error',
      '@typescript-eslint/consistent-type-assertions': ['error', { assertionStyle: 'as' }],
      // RULE.md §2 — Async: always await, never .then()/.catch()
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/promise-function-async': 'error',
      'no-restricted-syntax': [
        'error',
        {
          selector: "CallExpression[callee.property.name='then']",
          message: 'Use async/await instead of .then() (RULE.md §2).',
        },
        {
          selector: "CallExpression[callee.property.name='catch']",
          message: 'Use try/catch instead of .catch() (RULE.md §2).',
        },
        {
          selector: "JSXAttribute[name.name='dangerouslySetInnerHTML']",
          message:
            'No dangerouslySetInnerHTML: render text and links with components (RULE.md §11).',
        },
      ],
      // RULE.md §2 — Function rules (components included: keeps them small)
      'max-lines-per-function': ['error', { max: 30, skipBlankLines: true, skipComments: true }],
      'max-params': ['error', 3],
      'no-nested-ternary': 'error',
      // RULE.md §11 — Security
      'no-restricted-properties': [
        'error',
        { object: 'localStorage', message: 'Never store tokens in Web Storage (ADR-0005).' },
        { object: 'sessionStorage', message: 'Never store tokens in Web Storage (ADR-0005).' },
      ],
    },
  },
  {
    files: ['**/*.test.ts', '**/*.test.tsx', 'src/test/**'],
    rules: {
      // describe() blocks naturally exceed 30 lines
      'max-lines-per-function': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
    },
  },
);
