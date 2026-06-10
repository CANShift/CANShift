import { getSignalColor } from './signal-colors'

describe('getSignalColor', () => {
  it('derives a color for compact keys mapped to a SensorKind', () => {
    for (const key of ['r', 'ct', 'ot', 'op', 'iat', 'bst', 'lam']) {
      expect(getSignalColor(key)).toMatch(/^#[0-9A-F]{6}$/i)
    }
  })

  it('falls back to the mobile palette for non-sensor keys', () => {
    expect(getSignalColor('tps')).toBe('#FFD700')
    expect(getSignalColor('map')).toBe('#44AAFF')
    expect(getSignalColor('fp')).toBe('#FF88BB')
    expect(getSignalColor('s')).toBe('#CCCCCC')
    expect(getSignalColor('g')).toBe('#888888')
    expect(getSignalColor('bat')).toBe('#AAFFAA')
  })

  it('returns a sane default color for unknown keys', () => {
    expect(getSignalColor('nope_xyz')).toMatch(/^#[0-9A-F]{6}$/i)
  })
})
