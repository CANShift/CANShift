// @ts-check
import eslint from '@eslint/js'
import tseslint from 'typescript-eslint'
import prettierConfig from 'eslint-config-prettier'

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  prettierConfig,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // Allow void returns for event handlers
      '@typescript-eslint/no-misused-promises': ['error', { checksVoidReturn: false }],
      // Allow explicit any in rare cases with a comment
      '@typescript-eslint/no-explicit-any': 'error',
      // Prefer const
      'prefer-const': 'error',
      // No console in production code — use proper logging
      'no-console': ['warn', { allow: ['error', 'warn'] }],
    },
  },
  {
    // Relax rules for Electron main process (uses Node.js APIs)
    files: ['main/**/*.ts'],
    rules: {
      'no-console': 'off',
    },
  },
  {
    ignores: ['dist/**', 'release/**', 'node_modules/**', 'out/**'],
  }
)
