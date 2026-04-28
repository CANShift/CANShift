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
        projectService: {
          allowDefaultProject: ['*.mjs'],
        },
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      'prefer-const': 'error',
      'no-console': 'error',
    },
  },
  {
    // Config file itself: relax deprecated API rule (tseslint.config is the
    // current recommended pattern despite a transitional deprecation notice)
    files: ['eslint.config.mjs'],
    rules: {
      '@typescript-eslint/no-deprecated': 'off',
    },
  },
  {
    ignores: ['dist/**', 'node_modules/**'],
  }
)
