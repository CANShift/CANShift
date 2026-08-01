import {
  BRAND_COLOR_KEY_TO_CSS_VAR,
  BRAND_DIVIDER_CSS_VAR,
  BRAND_NEUTRAL_STEPS,
  BRAND_TEXT_CSS_VAR,
  BRAND_TOKENS,
  COLOR_KEY_TO_CSS_VAR,
  DARK_TOKENS,
  FONT_MONO_CSS_VAR,
  FONT_TOKENS,
  FONT_UI_CSS_VAR,
  brandNeutralCssVar,
  brandTokensToCssVars,
  fontTokensToCssVars,
  hexToHslChannels,
  tokensToCssVars,
} from '../design-tokens.js'
import { isHexColor } from '../colors/hex.js'

describe('DARK_TOKENS', () => {
  it('matches the canonical snapshot', () => {
    expect(DARK_TOKENS).toEqual({
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
    })
  })
})

describe('BRAND_TOKENS', () => {
  it('matches the canonical snapshot', () => {
    expect(BRAND_TOKENS).toEqual({
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
    })
  })

  it.each(Object.keys(BRAND_TOKENS.colors) as (keyof typeof BRAND_TOKENS.colors)[])(
    'colors.%s is a valid #RRGGBB hex',
    (key) => {
      expect(isHexColor(BRAND_TOKENS.colors[key])).toBe(true)
    }
  )

  it.each([...BRAND_NEUTRAL_STEPS])('darkNeutrals[%d] is a valid #RRGGBB hex', (step) => {
    expect(isHexColor(BRAND_TOKENS.darkNeutrals[step])).toBe(true)
  })

  it('darkText is a valid #RRGGBB hex', () => {
    expect(isHexColor(BRAND_TOKENS.darkText)).toBe(true)
  })

  it('never contains the device red', () => {
    const brandValues = [
      ...Object.values(BRAND_TOKENS.colors),
      ...Object.values(BRAND_TOKENS.darkNeutrals),
      BRAND_TOKENS.darkText,
      BRAND_TOKENS.darkDivider,
    ]
    expect(brandValues).not.toContain(DARK_TOKENS.colors.primary)
  })

  it('device tokens never contain the brand accent', () => {
    expect(Object.values(DARK_TOKENS.colors)).not.toContain(BRAND_TOKENS.colors.accent)
  })
})

describe('brandTokensToCssVars', () => {
  const EXPECTED_KEYS = [
    '--brand-accent',
    '--brand-ink',
    '--brand-ground',
    '--brand-surface',
    '--brand-rule',
    '--brand-chrome-bg',
    '--brand-chrome-surface',
    '--brand-neutral-100',
    '--brand-neutral-200',
    '--brand-neutral-300',
    '--brand-neutral-400',
    '--brand-neutral-500',
    '--brand-neutral-600',
    '--brand-neutral-700',
    '--brand-neutral-800',
    '--brand-neutral-900',
    '--brand-text',
    '--brand-divider',
  ] as const

  it('emits exactly the canonical CSS variable names', () => {
    const vars = brandTokensToCssVars(BRAND_TOKENS)
    expect(Object.keys(vars).sort()).toEqual([...EXPECTED_KEYS].sort())
  })

  it('converts hex colors to HSL channel format', () => {
    const vars = brandTokensToCssVars(BRAND_TOKENS)
    expect(vars['--brand-accent']).toBe(hexToHslChannels('#EC3013'))
    expect(vars['--brand-ink']).toBe(hexToHslChannels('#201E1D'))
    expect(vars[brandNeutralCssVar(100)]).toBe(hexToHslChannels('#1C1A1A'))
    expect(vars[BRAND_TEXT_CSS_VAR]).toBe(hexToHslChannels('#F3F2F2'))
  })

  it('passes the divider through as a raw CSS color', () => {
    const vars = brandTokensToCssVars(BRAND_TOKENS)
    expect(vars[BRAND_DIVIDER_CSS_VAR]).toBe('color-mix(in srgb, #F3F2F2 24%, transparent)')
  })

  it('shares no CSS variable names with the device set', () => {
    const brandKeys = Object.keys(brandTokensToCssVars(BRAND_TOKENS))
    const deviceKeys = Object.keys(tokensToCssVars(DARK_TOKENS))
    expect(brandKeys.filter((key) => deviceKeys.includes(key))).toEqual([])
  })

  it('maps every brand color key to a --brand-* variable', () => {
    for (const cssVar of Object.values(BRAND_COLOR_KEY_TO_CSS_VAR)) {
      expect(cssVar.startsWith('--brand-')).toBe(true)
    }
  })
})

describe('FONT_TOKENS', () => {
  it('matches the canonical snapshot', () => {
    expect(FONT_TOKENS).toEqual({
      ui: "'Archivo', system-ui, -apple-system, 'Segoe UI', sans-serif",
      mono: "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
    })
  })

  it('leads the UI stack with Archivo and ends both stacks with a generic family', () => {
    expect(FONT_TOKENS.ui.startsWith("'Archivo'")).toBe(true)
    expect(FONT_TOKENS.ui.endsWith('sans-serif')).toBe(true)
    expect(FONT_TOKENS.mono.endsWith('monospace')).toBe(true)
  })
})

describe('fontTokensToCssVars', () => {
  it('emits exactly the canonical CSS variable names', () => {
    const vars = fontTokensToCssVars(FONT_TOKENS)
    expect(Object.keys(vars).sort()).toEqual([FONT_MONO_CSS_VAR, FONT_UI_CSS_VAR].sort())
  })

  it('passes the stacks through unchanged', () => {
    const vars = fontTokensToCssVars(FONT_TOKENS)
    expect(vars[FONT_UI_CSS_VAR]).toBe(FONT_TOKENS.ui)
    expect(vars[FONT_MONO_CSS_VAR]).toBe(FONT_TOKENS.mono)
  })

  it('shares no CSS variable names with the color sets', () => {
    const fontKeys = Object.keys(fontTokensToCssVars(FONT_TOKENS))
    const colorKeys = [
      ...Object.keys(tokensToCssVars(DARK_TOKENS)),
      ...Object.keys(brandTokensToCssVars(BRAND_TOKENS)),
    ]
    expect(fontKeys.filter((key) => colorKeys.includes(key))).toEqual([])
  })
})

describe('hexToHslChannels', () => {
  const cases: readonly (readonly [string, string])[] = [
    ['#FF4747', '0 100% 64%'],
    ['#FF8800', '32 100% 50%'],
    ['#FFFFFF', '0 0% 100%'],
    ['#000000', '0 0% 0%'],
  ]

  it.each(cases)('converts %s to %s', (hex, expected) => {
    expect(hexToHslChannels(hex)).toBe(expected)
  })

  it('rejects malformed input', () => {
    expect(() => hexToHslChannels('FF4747')).toThrow(/Invalid hex color/)
    expect(() => hexToHslChannels('#FFF')).toThrow(/Invalid hex color/)
    expect(() => hexToHslChannels('#GGGGGG')).toThrow(/Invalid hex color/)
  })
})

describe('tokensToCssVars', () => {
  const EXPECTED_KEYS = [
    '--bg',
    '--bg-inset',
    '--surface',
    '--surface-2',
    '--border',
    '--primary',
    '--primary-foreground',
    '--secondary',
    '--secondary-foreground',
    '--accent',
    '--accent-foreground',
    '--accent-dim',
    '--destructive',
    '--destructive-foreground',
    '--text',
    '--text-dim',
    '--text-muted',
    '--success',
    '--success-bg',
    '--success-border',
    '--warning',
    '--danger',
    '--status-danger',
    '--status-danger-dim',
    '--scrim',
    '--ring',
    '--selection',
    '--selection-bg',
  ] as const

  it('emits exactly the canonical CSS variable names', () => {
    const vars = tokensToCssVars(DARK_TOKENS)
    expect(Object.keys(vars).sort()).toEqual([...EXPECTED_KEYS].sort())
  })

  it('converts each color to HSL channel format', () => {
    const vars = tokensToCssVars(DARK_TOKENS)
    expect(vars['--primary']).toBe('0 100% 64%')
    expect(vars['--accent']).toBe('32 100% 50%')
    expect(vars['--text']).toBe('0 0% 100%')
    expect(vars['--bg']).toBe('0 0% 7%')
    expect(vars['--danger']).toBe('0 100% 50%')
  })
})

describe('S-H-5 batch-1 promoted tokens (#1093 follow-up)', () => {
  const PROMOTED_KEYS = ['statusDanger', 'statusDangerDim', 'scrim'] as const

  it.each(PROMOTED_KEYS)('DARK_TOKENS.colors.%s is defined as a valid #RRGGBB hex', (key) => {
    const value = DARK_TOKENS.colors[key]
    expect(value).toBeDefined()
    expect(isHexColor(value)).toBe(true)
  })

  it.each(PROMOTED_KEYS)('emits a CSS variable mapping for %s', (key) => {
    const vars = tokensToCssVars(DARK_TOKENS)
    const cssVar = COLOR_KEY_TO_CSS_VAR[key]
    expect(cssVar).toBeDefined()
    expect(vars[cssVar]).toBeDefined()
  })
})
