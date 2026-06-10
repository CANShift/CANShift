import { THEME_PRESETS, getThemePreset } from '../theme-presets.js'
import type { ThemePresetId } from '../theme-presets.js'
import { ThemePresetSchema } from '../schemas/dashboard.js'

describe('THEME_PRESETS', () => {
  it('ships exactly the catalog ordered Default Dark / High Contrast / Subtle', () => {
    expect(THEME_PRESETS.map((p) => p.id)).toEqual(['default-dark', 'high-contrast', 'subtle'])
  })

  it('has unique ids', () => {
    const ids = THEME_PRESETS.map((p) => p.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('every entry has a non-empty label', () => {
    for (const p of THEME_PRESETS) {
      expect(p.label.length).toBeGreaterThan(0)
    }
  })

  it.each(THEME_PRESETS.map((p) => [p.id, p] as const))(
    '%s parses against ThemePresetSchema',
    (_id, entry) => {
      const result = ThemePresetSchema.safeParse(entry.theme)
      expect(result.success).toBe(true)
    }
  )

  it.each(THEME_PRESETS.map((p) => [p.id, p] as const))(
    '%s carries both bgColor and a full palette (8 keys)',
    (_id, entry) => {
      expect(entry.theme.bgColor).toMatch(/^#[0-9A-F]{6}$/)
      expect(entry.theme.palette).toBeDefined()
      if (entry.theme.palette) {
        expect(Object.keys(entry.theme.palette).sort()).toEqual([
          'accent',
          'danger',
          'primary',
          'success',
          'surface',
          'text',
          'textDim',
          'warning',
        ])
      }
    }
  )
})

describe('getThemePreset', () => {
  it.each(THEME_PRESETS.map((p) => p.id))('resolves the entry for id %s', (id) => {
    const entry = getThemePreset(id)
    expect(entry).toBeDefined()
    expect(entry?.id).toBe(id)
  })

  it('returns undefined for an unknown id', () => {
    expect(getThemePreset('mystery' as ThemePresetId)).toBeUndefined()
  })
})
