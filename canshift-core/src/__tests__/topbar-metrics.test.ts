import { TopBarMetrics } from '../topbar-metrics.js'

describe('TopBarMetrics', () => {
  it('pins the canonical proportion table', () => {
    expect(TopBarMetrics).toEqual({
      dotRatio: 0.3,
      fontSizeRatio: 0.45,
      separatorRatio: 0.55,
      gapRatio: 0.25,
      paddingRatio: 0.4,
      iconSizeRatio: 1.15,
      labelFontPx: 10,
      flagSquarePx: 7,
      flagGapPx: 3,
    })
  })

  const RATIO_KEYS = [
    'dotRatio',
    'fontSizeRatio',
    'separatorRatio',
    'gapRatio',
    'paddingRatio',
    'iconSizeRatio',
  ] as const

  const PIXEL_KEYS = ['labelFontPx', 'flagSquarePx', 'flagGapPx'] as const

  it('keeps every ratio in a sane range (0 < r <= 2)', () => {
    for (const key of RATIO_KEYS) {
      const value = TopBarMetrics[key]
      expect(typeof value).toBe('number')
      expect(value).toBeGreaterThan(0)
      const ceiling = key === 'iconSizeRatio' ? 2 : 1
      expect(value).toBeLessThanOrEqual(ceiling)
    }
  })

  it('keeps pixel constants as small positive integers', () => {
    for (const key of PIXEL_KEYS) {
      const value = TopBarMetrics[key]
      expect(Number.isInteger(value)).toBe(true)
      expect(value).toBeGreaterThan(0)
      expect(value).toBeLessThanOrEqual(16)
    }
  })
})
