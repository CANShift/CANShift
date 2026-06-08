// tailwind.config.ts — Mirrors canshift-studio-web. Tokens flow from
// canshift-core (single source of truth, #906).

import type { Config } from 'tailwindcss'
import tailwindcssAnimate from 'tailwindcss-animate'
import { COLOR_KEY_TO_CSS_VAR } from '@tmbk/canshift-core'

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
