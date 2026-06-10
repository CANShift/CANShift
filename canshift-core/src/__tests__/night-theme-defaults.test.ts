import {
  DAY_PALETTE_DEFAULT,
  DAY_THEME_PRESET,
  NIGHT_BG_DEFAULT,
  NIGHT_PALETTE_DEFAULT,
  NIGHT_THEME_PRESET,
} from '../index.js'
import { ThemePresetSchema } from '../schemas/dashboard.js'
import { isHexColor } from '../colors/hex.js'

describe('NIGHT_THEME_PRESET', () => {
  it('parses against ThemePresetSchema', () => {
    const result = ThemePresetSchema.safeParse(NIGHT_THEME_PRESET)
    expect(result.success).toBe(true)
  })

  it('matches the canonical snapshot', () => {
    expect(NIGHT_THEME_PRESET).toEqual({
      bgColor: '#000000',
      palette: {
        surface: '#1E1E1E',
        primary: '#FF4444',
        accent: '#FF8800',
        text: '#FFFFFF',
        textDim: '#888888',
        warning: '#FF8800',
        danger: '#FF4444',
        success: '#00CC44',
      },
    })
  })

  it('uses NIGHT_BG_DEFAULT as its bgColor', () => {
    expect(NIGHT_THEME_PRESET.bgColor).toBe(NIGHT_BG_DEFAULT)
  })

  it('uses NIGHT_PALETTE_DEFAULT as its palette', () => {
    expect(NIGHT_THEME_PRESET.palette).toEqual(NIGHT_PALETTE_DEFAULT)
  })
})

describe('NIGHT_PALETTE_DEFAULT', () => {
  it('has the exact same key set as DAY_PALETTE_DEFAULT (structural parity)', () => {
    expect(Object.keys(NIGHT_PALETTE_DEFAULT).sort()).toEqual(
      Object.keys(DAY_PALETTE_DEFAULT).sort()
    )
  })

  it('every channel is a valid #RRGGBB hex', () => {
    for (const value of Object.values(NIGHT_PALETTE_DEFAULT)) {
      expect(isHexColor(value)).toBe(true)
    }
  })
})

describe('NIGHT_THEME_PRESET vs DAY_THEME_PRESET', () => {
  it('shares the same top-level keys', () => {
    expect(Object.keys(NIGHT_THEME_PRESET).sort()).toEqual(Object.keys(DAY_THEME_PRESET).sort())
  })
})
