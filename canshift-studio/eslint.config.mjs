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
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          varsIgnorePattern: '^_',
          argsIgnorePattern: '^_',
          destructuredArrayIgnorePattern: '^_',
        },
      ],
      'prefer-const': 'error',
      'no-console': ['warn', { allow: ['error', 'warn'] }],
      // The renderer must NOT reach across into main-process source — anything
      // that crosses the process boundary (IPC channel names, payload shapes)
      // belongs under `shared/`. Importing from `main/` risks pulling main-only
      // deps (electron, fs, …) into the renderer bundle and breaks the sandbox
      // guarantee (#710).
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['../../main/*', '../../../main/*', '**/main/*'],
              message:
                'Renderer must not import from main/. Move shared IPC types/constants under shared/ and import from there.',
            },
          ],
        },
      ],
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
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          varsIgnorePattern: '^_',
          argsIgnorePattern: '^_',
          destructuredArrayIgnorePattern: '^_',
        },
      ],
      'prefer-const': 'error',
      'no-console': 'off',
    },
  },
  {
    // Root config files: relax type-aware rules (no tsconfig covers them)
    files: ['eslint.config.mjs', 'electron.vite.config.ts', 'vitest.config.ts'],
    languageOptions: {
      parserOptions: {
        projectService: {
          allowDefaultProject: ['*.mjs', '*.ts'],
        },
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/no-deprecated': 'off',
    },
  },
  {
    ignores: ['dist/**', 'release/**', 'node_modules/**', 'out/**', 'coverage/**'],
  }
)
