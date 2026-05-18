// ecu-profiles.test.ts — Coverage for the built-in ECU preset registry (#19).
//
// Each preset must validate against the canonical `SignalConfigSchema` shape
// so that selecting it in Studio always produces an importable signals.json.

import { ECU_PROFILES, SignalConfigSchema } from '../index.js'

describe('ECU_PROFILES — built-in preset registry', () => {
  it('exposes the generic-blank fallback', () => {
    const blank = ECU_PROFILES.find((p) => p.id === 'generic-blank')
    expect(blank).toBeDefined()
    expect(blank?.signals).toEqual([])
  })

  it.each(ECU_PROFILES.map((p) => [p.id, p]))(
    '%s validates as a complete signals catalog',
    (_id, profile) => {
      const catalog = {
        version: '1.0.0',
        protocol: profile.protocol,
        canSpeedKbps: 500,
        signals: profile.signals,
      }
      const result = SignalConfigSchema.safeParse(catalog)
      if (!result.success) {
        throw new Error(
          `${profile.id} failed validation:\n${JSON.stringify(result.error.issues, null, 2)}`
        )
      }
    }
  )

  it('every preset id is unique', () => {
    const ids = ECU_PROFILES.map((p) => p.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('every preset name is non-empty', () => {
    for (const p of ECU_PROFILES) {
      expect(p.name.trim().length).toBeGreaterThan(0)
    }
  })

  it('every preset description is non-empty', () => {
    for (const p of ECU_PROFILES) {
      expect(p.description.trim().length).toBeGreaterThan(0)
    }
  })

  it('every signal name is unique within a preset', () => {
    for (const p of ECU_PROFILES) {
      const names = p.signals.map((s) => s.name)
      expect(new Set(names).size).toBe(names.length)
    }
  })
})
