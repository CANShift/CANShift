import { SettingsWireSchema, parseSettings } from '../schemas/settings.js'

describe('SettingsWireSchema', () => {
  it('accepts a valid settings object', () => {
    const wire = { brightness: 80, sleep: 30 }
    expect(SettingsWireSchema.parse(wire)).toEqual(wire)
  })

  it('rejects extra wire fields (strict)', () => {
    expect(() => SettingsWireSchema.parse({ brightness: 80, sleep: 30, extra: 1 })).toThrow()
  })

  it('rejects missing fields', () => {
    expect(() => SettingsWireSchema.parse({ brightness: 80 })).toThrow()
  })

  it('rejects non-number fields', () => {
    expect(() => SettingsWireSchema.parse({ brightness: '80', sleep: 30 })).toThrow()
  })
})

describe('parseSettings', () => {
  it('returns ok for valid JSON', () => {
    const result = parseSettings(JSON.stringify({ brightness: 50, sleep: 0 }))
    expect(result).toEqual({ kind: 'ok', settings: { brightness: 50, sleep: 0 } })
  })

  it('flags invalid JSON', () => {
    expect(parseSettings('{not json').kind).toBe('invalid_json')
  })

  it('flags non-object payloads', () => {
    expect(parseSettings('42').kind).toBe('not_an_object')
    expect(parseSettings('[1,2]').kind).toBe('not_an_object')
  })

  it('flags wrong shapes', () => {
    expect(parseSettings(JSON.stringify({ brightness: 'x', sleep: 0 })).kind).toBe('wrong_shape')
  })
})
