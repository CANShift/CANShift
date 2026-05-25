// canshift-core/src/design-tokens.ts
//
// Single source of truth for CANShift visual design tokens (colors, radii,
// spacing, typography). Consumed by canshift-studio (Phase 1) and
// canshift-mobile (Phase 2) — keep this module pure TypeScript, no runtime
// dependencies, no Node or browser APIs.
//
// Hex values are the wire format; the `tokensToCssVars` helper converts them
// into the `H S% L%` HSL channel format that studio's tailwind config
// consumes via `hsl(var(--x) / <alpha-value>)`.

import { HEX_REGEX } from './colors/hex.js'

export interface DesignTokens {
  colors: {
    bg: string
    surface: string
    surface2: string
    border: string
    primary: string
    primaryForeground: string
    secondary: string
    secondaryForeground: string
    accent: string
    accentForeground: string
    destructive: string
    destructiveForeground: string
    text: string
    textDim: string
    textMuted: string
    success: string
    warning: string
    danger: string
    statusDanger: string
    statusDangerDim: string
    scrim: string
    ring: string
  }
  radii: { sm: number; md: number; lg: number; full: number }
  spacing: { xs: number; sm: number; md: number; lg: number; xl: number; xxl: number }
  typography: {
    xxs: number
    xs: number
    sm: number
    md: number
    lg: number
    xl: number
    xxl: number
    display: number
  }
}

/**
 * Canonical dark palette — mirrors the values currently shipping in
 * canshift-studio (src/index.css + tailwind.config.ts). Mobile drift will be
 * reconciled against this table in Phase 2 (issue #526).
 */
export const DARK_TOKENS = {
  colors: {
    bg: '#121212',
    surface: '#1F1F1F',
    surface2: '#292929',
    border: '#333333',
    primary: '#FF4747',
    primaryForeground: '#FFFFFF',
    secondary: '#292929',
    secondaryForeground: '#FFFFFF',
    accent: '#FF8800',
    accentForeground: '#FFFFFF',
    destructive: '#FF0000',
    destructiveForeground: '#FFFFFF',
    text: '#FFFFFF',
    textDim: '#BABABA',
    textMuted: '#8F8F8F',
    success: '#00CC2A',
    warning: '#FF8800',
    danger: '#FF0000',
    statusDanger: '#E03030',
    statusDangerDim: '#3A1A1A',
    scrim: '#000000',
    ring: '#FF4747',
  },
  radii: { sm: 4, md: 8, lg: 12, full: 9999 },
  spacing: { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 },
  typography: { xxs: 9, xs: 11, sm: 13, md: 15, lg: 18, xl: 22, xxl: 28, display: 36 },
} as const satisfies DesignTokens

/**
 * Light palette — placeholder alias of `DARK_TOKENS`. The theme editor
 * (issue #21) is on hold, so until a real light palette lands we deliberately
 * point at the dark one rather than duplicating the literal (audit C-ME-7,
 * umbrella #1016) — a future divergence then has to be intentional.
 *
 * Intentionally *not* re-exported from the package barrel until a real
 * consumer lands. Kept exported here so the shape check in
 * design-tokens.test.ts catches drift against DARK_TOKENS.
 *
 * TODO(#21): replace with a real light-mode palette when the theme editor ships.
 */
export const LIGHT_TOKENS: DesignTokens = DARK_TOKENS

interface RgbChannels {
  r: number
  g: number
  b: number
}

function parseHex(hex: string): RgbChannels {
  const match = HEX_REGEX.exec(hex)
  if (match?.[1] === undefined) {
    throw new Error(`Invalid hex color: ${hex} (expected #RRGGBB)`)
  }
  const value = match[1]
  return {
    r: parseInt(value.slice(0, 2), 16) / 255,
    g: parseInt(value.slice(2, 4), 16) / 255,
    b: parseInt(value.slice(4, 6), 16) / 255,
  }
}

/**
 * Convert a hex color (`#RRGGBB`) to the `H S% L%` channel format consumed by
 * `hsl(var(--x) / <alpha-value>)`. H is rounded to integer degrees (0-360);
 * S and L are rounded to integer percentages.
 */
export function hexToHslChannels(hex: string): string {
  const { r, g, b } = parseHex(hex)
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const delta = max - min
  const l = (max + min) / 2

  let h = 0
  let s = 0
  if (delta !== 0) {
    s = delta / (1 - Math.abs(2 * l - 1))
    if (max === r) {
      h = ((g - b) / delta) % 6
    } else if (max === g) {
      h = (b - r) / delta + 2
    } else {
      h = (r - g) / delta + 4
    }
    h *= 60
    if (h < 0) h += 360
  }

  const hRounded = (Math.round(h) % 360).toString()
  const sRounded = Math.round(s * 100).toString()
  const lRounded = Math.round(l * 100).toString()
  return `${hRounded} ${sRounded}% ${lRounded}%`
}

/**
 * Mapping from `DesignTokens.colors` keys to the CSS variable names already
 * defined in canshift-studio/src/index.css and tailwind.config.ts. Phase 0
 * does NOT introduce new variables — the studio migration in Phase 1 will
 * adopt this helper as the single source of truth without renaming anything.
 */
/**
 * Map every token color key (e.g. `bg`, `primaryForeground`) to its
 * corresponding `--*` CSS variable name. Exposed so downstream Tailwind /
 * styled-components configs can derive their color tables from a single
 * source of truth instead of re-listing the keys by hand (issue #906).
 */
export const COLOR_KEY_TO_CSS_VAR: Record<keyof DesignTokens['colors'], string> = {
  bg: '--bg',
  surface: '--surface',
  surface2: '--surface-2',
  border: '--border',
  primary: '--primary',
  primaryForeground: '--primary-foreground',
  secondary: '--secondary',
  secondaryForeground: '--secondary-foreground',
  accent: '--accent',
  accentForeground: '--accent-foreground',
  destructive: '--destructive',
  destructiveForeground: '--destructive-foreground',
  text: '--text',
  textDim: '--text-dim',
  textMuted: '--text-muted',
  success: '--success',
  warning: '--warning',
  danger: '--danger',
  statusDanger: '--status-danger',
  statusDangerDim: '--status-danger-dim',
  scrim: '--scrim',
  ring: '--ring',
}

/**
 * Convert a `DesignTokens` object to a flat `Record<cssVarName, hslChannels>`
 * suitable for injection into `:root { ... }` or a styled element. Only color
 * tokens are emitted today (radii/spacing/typography are consumed directly by
 * components, not via CSS variables).
 */
export function tokensToCssVars(tokens: DesignTokens): Record<string, string> {
  const out: Record<string, string> = {}
  for (const key of Object.keys(COLOR_KEY_TO_CSS_VAR) as (keyof DesignTokens['colors'])[]) {
    const cssVar = COLOR_KEY_TO_CSS_VAR[key]
    out[cssVar] = hexToHslChannels(tokens.colors[key])
  }
  return out
}
