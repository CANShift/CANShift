import eslint from '@eslint/js'
import tseslint from 'typescript-eslint'
import prettierConfig from 'eslint-config-prettier'

const KEEP_COMMENT_PATTERN =
  /^[\s/]*(eslint-(disable|enable)|@ts-(expect-error|ignore|nocheck)|@typescript-eslint|<reference)/

const noCommentsPlugin = {
  rules: {
    'no-comments': {
      meta: {
        type: 'problem',
        docs: { description: 'Disallow comments; allow only load-bearing directives.' },
        schema: [],
        messages: {
          forbidden:
            'Comments are forbidden in this package. Allowed directives: eslint-*, @ts-expect-error.',
        },
      },
      create(context) {
        return {
          Program() {
            for (const comment of context.sourceCode.getAllComments()) {
              if (KEEP_COMMENT_PATTERN.test(comment.value)) continue
              context.report({ loc: comment.loc, messageId: 'forbidden' })
            }
          },
        }
      },
    },
  },
}

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  prettierConfig,
  {
    plugins: { 'no-comments': noCommentsPlugin },
    files: ['src/**/*.{ts,tsx}', 'index.ts', 'App.tsx'],
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
      'no-console': ['error', { allow: ['warn', 'error'] }],
      'no-empty': ['error', { allowEmptyCatch: true }],
      'no-comments/no-comments': 'error',
      'func-style': ['error', 'expression'],
      'max-depth': ['error', 3],
    },
  },
  {
    ignores: [
      'node_modules/**',
      '.expo/**',
      'ios/**',
      'android/**',
      'assets/**',
      'coverage/**',
      'plugins/**',
      'app.config.ts',
      'babel.config.js',
      'eslint.config.mjs',
      'jest.config.js',
      'scripts/**',
      'nativewind-env.d.ts',
      'tailwind.config.ts',
      'metro.config.js',
      'global.css',
      '__mocks__/**',
    ],
  }
)
