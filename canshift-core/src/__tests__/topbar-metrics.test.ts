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
    })
  })

  it('keeps every ratio in a sane range (0 < r <= 2)', () => {
    for (const [key, value] of Object.entries(TopBarMetrics)) {
      expect(typeof value).toBe('number')
      expect(value).toBeGreaterThan(0)
      const ceiling = key === 'iconSizeRatio' ? 2 : 1
      expect(value).toBeLessThanOrEqual(ceiling)
    }
  })
})
