import { ScreenSettingsSchema, SCREEN_SETTINGS_BOUNDS } from '../index.js'

describe('ScreenSettingsSchema', () => {
  describe('valid payloads', () => {
    it('accepts the minimal { brightness, sleep } shape', () => {
      const result = ScreenSettingsSchema.safeParse({ brightness: 80, sleep: 30 })
      expect(result.success).toBe(true)
    })

    it('accepts an optional rotation of 0', () => {
      const result = ScreenSettingsSchema.safeParse({ brightness: 50, sleep: 0, rotation: 0 })
      expect(result.success).toBe(true)
    })

    it('accepts an optional rotation of 180', () => {
      const result = ScreenSettingsSchema.safeParse({ brightness: 50, sleep: 0, rotation: 180 })
      expect(result.success).toBe(true)
    })

    it('accepts brightness at the lower bound (0)', () => {
      const result = ScreenSettingsSchema.safeParse({ brightness: 0, sleep: 0 })
      expect(result.success).toBe(true)
    })

    it('accepts brightness at the upper bound (100)', () => {
      const result = ScreenSettingsSchema.safeParse({ brightness: 100, sleep: 0 })
      expect(result.success).toBe(true)
    })

    it('accepts sleep at the upper bound (3600)', () => {
      const result = ScreenSettingsSchema.safeParse({ brightness: 50, sleep: 3600 })
      expect(result.success).toBe(true)
    })
  })

  describe('brightness bounds', () => {
    it('rejects brightness below 0', () => {
      const result = ScreenSettingsSchema.safeParse({ brightness: -1, sleep: 0 })
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues.some((i) => i.path.includes('brightness'))).toBe(true)
      }
    })

    it('rejects the audit repro case brightness=-9999', () => {
      const result = ScreenSettingsSchema.safeParse({ brightness: -9999, sleep: 0 })
      expect(result.success).toBe(false)
    })

    it('rejects brightness above 100', () => {
      const result = ScreenSettingsSchema.safeParse({ brightness: 101, sleep: 0 })
      expect(result.success).toBe(false)
    })

    it('rejects non-integer brightness', () => {
      const result = ScreenSettingsSchema.safeParse({ brightness: 50.5, sleep: 0 })
      expect(result.success).toBe(false)
    })

    it('rejects non-finite brightness (NaN)', () => {
      const result = ScreenSettingsSchema.safeParse({ brightness: Number.NaN, sleep: 0 })
      expect(result.success).toBe(false)
    })

    it('rejects non-finite brightness (+Infinity)', () => {
      const result = ScreenSettingsSchema.safeParse({
        brightness: Number.POSITIVE_INFINITY,
        sleep: 0,
      })
      expect(result.success).toBe(false)
    })
  })

  describe('sleep bounds', () => {
    it('rejects sleep below 0', () => {
      const result = ScreenSettingsSchema.safeParse({ brightness: 80, sleep: -1 })
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues.some((i) => i.path.includes('sleep'))).toBe(true)
      }
    })

    it('rejects sleep above 3600 (audit repro: 86400000 / 24h)', () => {
      const result = ScreenSettingsSchema.safeParse({ brightness: 80, sleep: 86_400_000 })
      expect(result.success).toBe(false)
    })

    it('rejects non-integer sleep', () => {
      const result = ScreenSettingsSchema.safeParse({ brightness: 80, sleep: 30.5 })
      expect(result.success).toBe(false)
    })
  })

  describe('rotation', () => {
    it('rejects rotation = 90', () => {
      const result = ScreenSettingsSchema.safeParse({ brightness: 80, sleep: 30, rotation: 90 })
      expect(result.success).toBe(false)
    })

    it('rejects rotation = 360', () => {
      const result = ScreenSettingsSchema.safeParse({ brightness: 80, sleep: 30, rotation: 360 })
      expect(result.success).toBe(false)
    })
  })

  describe('strict object', () => {
    it('rejects unknown top-level keys', () => {
      const result = ScreenSettingsSchema.safeParse({
        brightness: 80,
        sleep: 30,
        mystery: 'nope',
      })
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues.some((i) => i.code === 'unrecognized_keys')).toBe(true)
      }
    })

    it('rejects missing brightness', () => {
      const result = ScreenSettingsSchema.safeParse({ sleep: 30 })
      expect(result.success).toBe(false)
    })

    it('rejects missing sleep', () => {
      const result = ScreenSettingsSchema.safeParse({ brightness: 80 })
      expect(result.success).toBe(false)
    })
  })

  describe('SCREEN_SETTINGS_BOUNDS', () => {
    it('matches the schema bounds the studio UI consumes', () => {
      expect(SCREEN_SETTINGS_BOUNDS.brightnessMinPct).toBe(0)
      expect(SCREEN_SETTINGS_BOUNDS.brightnessMaxPct).toBe(100)
      expect(SCREEN_SETTINGS_BOUNDS.sleepMinSeconds).toBe(0)
      expect(SCREEN_SETTINGS_BOUNDS.sleepMaxSeconds).toBe(3600)
      expect(SCREEN_SETTINGS_BOUNDS.allowedRotations).toEqual([0, 180])
    })
  })
})
