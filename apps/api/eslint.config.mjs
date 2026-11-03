// @ts-check
import eslint from '@eslint/js';
import prettier from 'eslint-config-prettier';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist/**', 'coverage/**', 'src/generated/**', 'eslint.config.mjs'] },
  eslint.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  prettier,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
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
          selector:
            "CallExpression[callee.property.name='catch'][callee.object.type!='Identifier']",
          message: 'Use try/catch instead of .catch() (RULE.md §2).',
        },
      ],
      // RULE.md §2 — Function rules
      'max-lines-per-function': ['error', { max: 30, skipBlankLines: true, skipComments: true }],
      'max-params': ['error', 3],
      'no-nested-ternary': 'error',
      // NestJS uses empty classes for modules and DI tokens
      '@typescript-eslint/no-extraneous-class': 'off',
    },
  },
  {
    files: ['**/*.spec.ts', '**/*.e2e-spec.ts', 'test/**/*.ts'],
    rules: {
      // describe() blocks naturally exceed 30 lines
      'max-lines-per-function': 'off',
      '@typescript-eslint/unbound-method': 'off',
      // Jest asymmetric matchers (expect.any, expect.objectContaining...) are typed as `any`
      '@typescript-eslint/no-unsafe-assignment': 'off',
    },
  },
);
