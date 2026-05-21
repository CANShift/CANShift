import type { Config } from 'tailwindcss'
import tailwindcssAnimate from 'tailwindcss-animate'
import { COLOR_KEY_TO_CSS_VAR } from '@tmbk/canshift-core'

// Derive Tailwind color tokens from canshift-core's single source of truth.
// The keyset used to be re-listed by hand here, which let "add a token in
// core but forget to wire it into Tailwind" drift past CI (#906). Convention:
//  - Class name is the CSS var name with the leading `--` stripped — that way
//    `--surface-2`, `--text-dim`, `--primary-foreground` all flow through
//    intact without per-key special cases.
//  - CSS vars ending in `-foreground` collapse into `<base>: { DEFAULT, foreground }`.
//  - Aliases (Tailwind class name != core token) live in `COLOR_ALIASES` below.
const cssVarReference = (cssVar: string): string => `hsl(var(${cssVar}) / <alpha-value>)`
const classNameFromCssVar = (cssVar: string): string => cssVar.replace(/^--/, '')

type ColorEntry = string | { DEFAULT: string; foreground: string }
const colorsFromTokens = (): Record<string, ColorEntry> => {
  const out: Record<string, ColorEntry> = {}
  for (const cssVar of Object.values(COLOR_KEY_TO_CSS_VAR)) {
    const fullClass = classNameFromCssVar(cssVar)
    const value = cssVarReference(cssVar)
    if (fullClass.endsWith('-foreground')) {
      const baseClass = fullClass.replace(/-foreground$/, '')
      const existing = out[baseClass]
      const baseDefault =
        typeof existing === 'object' && existing !== null
          ? existing.DEFAULT
          : (existing as string | undefined)
      // Defensive: every -foreground CSS var in COLOR_KEY_TO_CSS_VAR has a
      // matching base, but if a future refactor breaks that invariant we
      // want a loud failure here instead of a silent `{ DEFAULT: undefined }`.
      if (baseDefault === undefined) {
        throw new Error(`Tailwind colors: '${fullClass}' has no matching base '${baseClass}'`)
      }
      out[baseClass] = { DEFAULT: baseDefault, foreground: value }
    } else {
      out[fullClass] = value
    }
  }
  return out
}

// Tailwind class names that do not correspond 1:1 to a core token key but the
// renderer relies on (shadcn defaults, legacy usages). Keep the list short —
// every entry here is a candidate for promotion to a real core token.
const COLOR_ALIASES: Record<string, string> = {
  background: cssVarReference(COLOR_KEY_TO_CSS_VAR.bg),
  input: cssVarReference(COLOR_KEY_TO_CSS_VAR.border),
}

const config: Config = {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ...colorsFromTokens(),
        ...COLOR_ALIASES,
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
      },
    },
  },
  plugins: [tailwindcssAnimate],
}

export default config
