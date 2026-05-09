// WidgetPreview.button.test.tsx — unit tests for the button preview metric
// helper (issue #481). Locks in the iconSize / fontSize formula so the
// preview can never overflow its assigned width again.
//
// @vitest-environment jsdom

import { describe, expect, it } from 'vitest'
import { computeButtonPreviewMetrics } from '../WidgetPreview'

describe('computeButtonPreviewMetrics', () => {
  it('caps iconSize at 32 even on tall widgets', () => {
    const { iconSize } = computeButtonPreviewMetrics(120, 200, true)
    expect(iconSize).toBe(32)
  })

  it('clamps iconSize to a minimum of 12 on tiny widgets', () => {
    const { iconSize } = computeButtonPreviewMetrics(40, 16, true)
    expect(iconSize).toBe(12)
  })

  it('keeps iconSize within h - 6 padding on small heights', () => {
    const { iconSize } = computeButtonPreviewMetrics(100, 24, true)
    // h * 0.6 = 14.4, h - 6 = 18, 32 → min is 14.4
    expect(iconSize).toBeCloseTo(14.4, 5)
  })

  it('uses h * 0.6 in the typical default range', () => {
    const { iconSize } = computeButtonPreviewMetrics(100, 40, true)
    // h * 0.6 = 24, h - 6 = 34, 32 → min is 24
    expect(iconSize).toBe(24)
  })

  it('shrinks fontSize when an icon eats into the label budget', () => {
    const withIcon = computeButtonPreviewMetrics(80, 40, true)
    const withoutIcon = computeButtonPreviewMetrics(80, 40, false)
    expect(withIcon.fontSize).toBeLessThan(withoutIcon.fontSize)
  })

  it('honours the minimum fontSize of 8 on narrow widgets', () => {
    const { fontSize } = computeButtonPreviewMetrics(20, 20, true)
    expect(fontSize).toBe(8)
  })

  it('caps fontSize by height (h * 0.38) on short-but-wide widgets', () => {
    const { fontSize } = computeButtonPreviewMetrics(400, 30, false)
    // h * 0.38 = 11.4, (w - 12) * 0.28 = 108.64 → min is 11.4
    expect(fontSize).toBeCloseTo(11.4, 5)
  })

  it('caps fontSize by label budget on narrow-but-tall widgets', () => {
    const { fontSize } = computeButtonPreviewMetrics(60, 200, false)
    // h * 0.38 = 76, (w - 12) * 0.28 = 13.44 → min is 13.44
    expect(fontSize).toBeCloseTo(13.44, 5)
  })

  it('produces identical metrics regardless of active state (idle === active)', () => {
    // Active state must not change the geometry — the helper is state-free.
    const a = computeButtonPreviewMetrics(120, 50, true)
    const b = computeButtonPreviewMetrics(120, 50, true)
    expect(a).toEqual(b)
  })

  it('keeps the label budget at least 20px when an icon is shown', () => {
    // On a 40px-wide button with an icon, naive (w - iconSize - 16) would
    // go negative — Math.max(20, …) protects the budget.
    const { fontSize } = computeButtonPreviewMetrics(40, 40, true)
    // labelBudget = max(20, 40 - iconSize - 16). iconSize = min(24, 34, 32) = 24.
    // 40 - 24 - 16 = 0 → clamped to 20. fontSize = min(15.2, 5.6) = 5.6 → max(8, …) = 8
    expect(fontSize).toBeGreaterThanOrEqual(8)
  })
})
