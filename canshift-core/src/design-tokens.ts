import { HEX_REGEX } from './colors/hex.js'

export interface DesignTokens {
  colors: {
    bg: string
    bgInset: string
    surface: string
    surface2: string
    border: string
    primary: string
    primaryForeground: string
    secondary: string
    secondaryForeground: string
    accent: string
    accentForeground: string
    accentDim: string
    destructive: string
    destructiveForeground: string
    text: string
    textDim: string
    textMuted: string
    success: string
    successBg: string
    successBorder: string
    warning: string
    danger: string
    statusDanger: string
    statusDangerDim: string
    scrim: string
    ring: string
    selection: string
    selectionBg: string
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

export const BRAND_NEUTRAL_STEPS = [100, 200, 300, 400, 500, 600, 700, 800, 900] as const

export type BrandNeutralStep = (typeof BRAND_NEUTRAL_STEPS)[number]

export interface BrandTokens {
  colors: {
    accent: string
    ink: string
    ground: string
    surface: string
    rule: string
    chromeBg: string
    chromeSurface: string
  }
  darkNeutrals: Record<BrandNeutralStep, string>
  darkText: string
  darkDivider: string
}

export const BRAND_TOKENS = {
  colors: {
    accent: '#EC3013',
    ink: '#201E1D',
    ground: '#F3F2F2',
    surface: '#EAE9E9',
    rule: '#D7D3D3',
    chromeBg: '#151313',
    chromeSurface: '#1F1D1D',
  },
  darkNeutrals: {
    100: '#1C1A1A',
    200: '#262323',
    300: '#383434',
    400: '#4D4949',
    500: '#7D7979',
    600: '#9B9797',
    700: '#C2BFBF',
    800: '#E2DFDF',
    900: '#F5F4F4',
  },
  darkText: '#F3F2F2',
  darkDivider: 'color-mix(in srgb, #F3F2F2 24%, transparent)',
} as const satisfies BrandTokens

export const DARK_TOKENS = {
  colors: {
    bg: '#121212',
    bgInset: '#080808',
    surface: '#1F1F1F',
    surface2: '#292929',
    border: '#333333',
    primary: '#FF4747',
    primaryForeground: '#FFFFFF',
    secondary: '#292929',
    secondaryForeground: '#FFFFFF',
    accent: '#FF8800',
    accentForeground: '#FFFFFF',
    accentDim: '#1A0808',
    destructive: '#FF0000',
    destructiveForeground: '#FFFFFF',
    text: '#FFFFFF',
    textDim: '#BABABA',
    textMuted: '#8F8F8F',
    success: '#00CC2A',
    successBg: '#1A3A1A',
    successBorder: '#336633',
    warning: '#FF8800',
    danger: '#FF0000',
    statusDanger: '#E03030',
    statusDangerDim: '#3A1A1A',
    scrim: '#000000',
    ring: '#FF4747',
    selection: '#6CB6FF',
    selectionBg: '#1B2030',
  },
  radii: { sm: 0, md: 0, lg: 0, full: 0 },
  spacing: { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 },
  typography: { xxs: 9, xs: 11, sm: 13, md: 15, lg: 18, xl: 22, xxl: 28, display: 36 },
} as const satisfies DesignTokens

interface RgbChannels {
  r: number
  g: number
  b: number
}

const parseHex = (hex: string): RgbChannels => {
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

export const hexToHslChannels = (hex: string): string => {
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

export const COLOR_KEY_TO_CSS_VAR: Record<keyof DesignTokens['colors'], string> = {
  bg: '--bg',
  bgInset: '--bg-inset',
  surface: '--surface',
  surface2: '--surface-2',
  border: '--border',
  primary: '--primary',
  primaryForeground: '--primary-foreground',
  secondary: '--secondary',
  secondaryForeground: '--secondary-foreground',
  accent: '--accent',
  accentForeground: '--accent-foreground',
  accentDim: '--accent-dim',
  destructive: '--destructive',
  destructiveForeground: '--destructive-foreground',
  text: '--text',
  textDim: '--text-dim',
  textMuted: '--text-muted',
  success: '--success',
  successBg: '--success-bg',
  successBorder: '--success-border',
  warning: '--warning',
  danger: '--danger',
  statusDanger: '--status-danger',
  statusDangerDim: '--status-danger-dim',
  scrim: '--scrim',
  ring: '--ring',
  selection: '--selection',
  selectionBg: '--selection-bg',
}

export const tokensToCssVars = (tokens: DesignTokens): Record<string, string> => {
  const out: Record<string, string> = {}
  for (const key of Object.keys(COLOR_KEY_TO_CSS_VAR) as (keyof DesignTokens['colors'])[]) {
    const cssVar = COLOR_KEY_TO_CSS_VAR[key]
    out[cssVar] = hexToHslChannels(tokens.colors[key])
  }
  return out
}

export const BRAND_COLOR_KEY_TO_CSS_VAR: Record<keyof BrandTokens['colors'], string> = {
  accent: '--brand-accent',
  ink: '--brand-ink',
  ground: '--brand-ground',
  surface: '--brand-surface',
  rule: '--brand-rule',
  chromeBg: '--brand-chrome-bg',
  chromeSurface: '--brand-chrome-surface',
}

export const BRAND_TEXT_CSS_VAR = '--brand-text'

export const BRAND_DIVIDER_CSS_VAR = '--brand-divider'

export const brandNeutralCssVar = (step: BrandNeutralStep): string =>
  `--brand-neutral-${String(step)}`

export interface FontTokens {
  ui: string
  mono: string
}

export const FONT_TOKENS = {
  ui: "'Archivo', system-ui, -apple-system, 'Segoe UI', sans-serif",
  mono: "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
} as const satisfies FontTokens

export const FONT_UI_CSS_VAR = '--font-ui'

export const FONT_MONO_CSS_VAR = '--font-mono'

export const fontTokensToCssVars = (tokens: FontTokens): Record<string, string> => ({
  [FONT_UI_CSS_VAR]: tokens.ui,
  [FONT_MONO_CSS_VAR]: tokens.mono,
})

export const brandTokensToCssVars = (tokens: BrandTokens): Record<string, string> => {
  const out: Record<string, string> = {}
  for (const key of Object.keys(BRAND_COLOR_KEY_TO_CSS_VAR) as (keyof BrandTokens['colors'])[]) {
    out[BRAND_COLOR_KEY_TO_CSS_VAR[key]] = hexToHslChannels(tokens.colors[key])
  }
  for (const step of BRAND_NEUTRAL_STEPS) {
    out[brandNeutralCssVar(step)] = hexToHslChannels(tokens.darkNeutrals[step])
  }
  out[BRAND_TEXT_CSS_VAR] = hexToHslChannels(tokens.darkText)
  out[BRAND_DIVIDER_CSS_VAR] = tokens.darkDivider
  return out
}
