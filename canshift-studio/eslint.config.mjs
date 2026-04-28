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
    // Renderer process: Vite / React (tsconfig.json via project service)
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/no-misused-promises': ['error', { checksVoidReturn: false }],
      '@typescript-eslint/no-explicit-any': 'error',
      'prefer-const': 'error',
      'no-console': ['warn', { allow: ['error', 'warn'] }],
    },
  },
  {
    // Electron main process: Node.js (tsconfig.main.json, explicit project path)
    files: ['main/**/*.ts'],
    languageOptions: {
      parserOptions: {
        project: './tsconfig.main.json',
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/no-misused-promises': ['error', { checksVoidReturn: false }],
      '@typescript-eslint/no-explicit-any': 'error',
      'prefer-const': 'error',
      'no-console': 'off',
    },
  },
  {
    // Config file: relax deprecated-API rule (tseslint.config is still valid)
    files: ['eslint.config.mjs'],
    languageOptions: {
      parserOptions: {
        projectService: {
          allowDefaultProject: ['*.mjs'],
        },
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/no-deprecated': 'off',
    },
  },
  {
    ignores: ['dist/**', 'release/**', 'node_modules/**', 'out/**'],
  }
)
