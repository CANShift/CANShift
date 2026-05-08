// topbar-metrics.test.ts — pin TopBar proportion ratios.
//
// Both the Studio preview and the firmware C++ mirror read from these
// numbers. Pinning them prevents accidental drift; if a value is changed
// here, the firmware top_bar.cpp constants MUST be updated to match.

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
      // iconSizeRatio is relative to font size and may exceed 1; everything
      // else is relative to the bar height and must stay under 1.
      const ceiling = key === 'iconSizeRatio' ? 2 : 1
      expect(value).toBeLessThanOrEqual(ceiling)
    }
  })
})
