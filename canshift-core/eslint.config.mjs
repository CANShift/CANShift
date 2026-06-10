import eslint from '@eslint/js'
import tseslint from 'typescript-eslint'
import prettierConfig from 'eslint-config-prettier'

const KEEP_COMMENT_PATTERN =
  /^\s*(eslint-(disable|enable)|@ts-(expect-error|ignore|nocheck)|@typescript-eslint)/

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
    languageOptions: {
      parserOptions: {
        projectService: {
          allowDefaultProject: ['*.mjs', 'jest.config.ts'],
        },
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      'prefer-const': 'error',
      'no-console': 'error',
      'no-comments/no-comments': 'error',
      'func-style': ['error', 'expression'],
      'max-depth': ['error', 3],
    },
  },
  {
    files: ['eslint.config.mjs'],
    rules: {
      '@typescript-eslint/no-deprecated': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
    },
  },
  {
    files: ['src/__tests__/**/*.test.ts'],
    rules: {
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/dot-notation': 'off',
    },
  },
  {
    ignores: ['dist/**', 'node_modules/**', 'scripts/**'],
  }
)
