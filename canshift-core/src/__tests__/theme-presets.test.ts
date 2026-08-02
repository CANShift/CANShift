import { DEFAULT_PAGE_PALETTE, ThemePresetSchema } from '../schemas/dashboard.js'
import { DAY_BG_DEFAULT, DAY_PALETTE_DEFAULT } from '../day-theme-defaults.js'
import { THEME_PRESETS, themePresetById } from '../theme-presets.js'

describe('THEME_PRESETS', () => {
  it('ships the eight handoff themes in order', () => {
    expect(THEME_PRESETS.map((t) => t.id)).toEqual([
      'night',
      'day',
      'endurance',
      'rally',
      'drag',
      'circuit',
      'ice',
      'paper',
    ])
  })

  it.each(THEME_PRESETS.map((t) => [t.id, t] as const))(
    '%s validates against ThemePresetSchema',
    (_id, entry) => {
      expect(() => ThemePresetSchema.parse(entry.preset)).not.toThrow()
    }
  )

  it('every entry carries a full palette', () => {
    for (const entry of THEME_PRESETS) {
      expect(entry.preset.palette).toBeDefined()
    }
  })

  it('night reuses the device default palette on the device background', () => {
    const night = themePresetById('night')
    expect(night?.preset.palette).toEqual(DEFAULT_PAGE_PALETTE)
    expect(night?.preset.bgColor).toBe('#121212')
  })

  it('day reuses the existing day defaults', () => {
    const day = themePresetById('day')
    expect(day?.preset.palette).toEqual(DAY_PALETTE_DEFAULT)
    expect(day?.preset.bgColor).toBe(DAY_BG_DEFAULT)
  })

  it('ids are unique and kebab-case', () => {
    const ids = THEME_PRESETS.map((t) => t.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const id of ids) {
      expect(id).toMatch(/^[a-z][a-z0-9-]*$/)
    }
  })

  it('light themes keep dark text and dark themes keep light text', () => {
    const luminance = (hex: string): number => {
      const r = parseInt(hex.slice(1, 3), 16)
      const g = parseInt(hex.slice(3, 5), 16)
      const b = parseInt(hex.slice(5, 7), 16)
      return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255
    }
    for (const entry of THEME_PRESETS) {
      const palette = entry.preset.palette
      if (!palette) continue
      const bgLum = luminance(entry.preset.bgColor)
      const textLum = luminance(palette.text)
      expect(Math.abs(bgLum - textLum)).toBeGreaterThan(0.3)
    }
  })

  it('themePresetById returns undefined for unknown ids', () => {
    expect(themePresetById('nope')).toBeUndefined()
  })
})
