// design-tokens.test.ts — pin canonical design tokens and HSL conversion.
//
// Any change to DARK_TOKENS values is intentional and must show up in review.
// LIGHT_TOKENS shares the same shape so consumers can swap themes safely.

import { DARK_TOKENS, LIGHT_TOKENS, hexToHslChannels, tokensToCssVars } from '../design-tokens.js'

describe('DARK_TOKENS', () => {
  it('matches the canonical snapshot', () => {
    expect(DARK_TOKENS).toEqual({
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
        ring: '#FF4747',
      },
      radii: { sm: 4, md: 8, lg: 12, full: 9999 },
      spacing: { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 },
      typography: { xxs: 9, xs: 11, sm: 13, md: 15, lg: 18, xl: 22, xxl: 28, display: 36 },
    })
  })
})

describe('LIGHT_TOKENS', () => {
  it('has the exact same key set as DARK_TOKENS (structural parity)', () => {
    expect(Object.keys(LIGHT_TOKENS.colors).sort()).toEqual(Object.keys(DARK_TOKENS.colors).sort())
    expect(Object.keys(LIGHT_TOKENS.radii).sort()).toEqual(Object.keys(DARK_TOKENS.radii).sort())
    expect(Object.keys(LIGHT_TOKENS.spacing).sort()).toEqual(
      Object.keys(DARK_TOKENS.spacing).sort()
    )
    expect(Object.keys(LIGHT_TOKENS.typography).sort()).toEqual(
      Object.keys(DARK_TOKENS.typography).sort()
    )
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
    '--surface',
    '--surface-2',
    '--border',
    '--primary',
    '--primary-foreground',
    '--secondary',
    '--secondary-foreground',
    '--accent',
    '--accent-foreground',
    '--destructive',
    '--destructive-foreground',
    '--text',
    '--text-dim',
    '--text-muted',
    '--success',
    '--warning',
    '--danger',
    '--ring',
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
