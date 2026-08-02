import { describe, expect, it } from 'vitest'
import type { DashboardConfig, Widget } from '@tmbk/canshift-core'
import { isUnboundWidget, unboundWidgetCount } from './unbound-widgets'

const widget = (type: string, signal: string): Widget => ({ type, signal }) as Widget

const configWith = (widgets: Widget[][]): DashboardConfig =>
  ({ pages: widgets.map((w, i) => ({ id: `p${String(i)}`, widgets: w })) }) as DashboardConfig

describe('unbound widgets', () => {
  it('flags signal-consuming widgets with an empty signal', () => {
    expect(isUnboundWidget(widget('gauge', ''))).toBe(true)
    expect(isUnboundWidget(widget('gear', ''))).toBe(true)
    expect(isUnboundWidget(widget('warning', ''))).toBe(true)
    expect(isUnboundWidget(widget('shift_light', ''))).toBe(true)
  })

  it('ignores bound widgets and non-consuming types', () => {
    expect(isUnboundWidget(widget('gauge', 'rpm'))).toBe(false)
    expect(isUnboundWidget(widget('button', ''))).toBe(false)
    expect(isUnboundWidget(widget('image', ''))).toBe(false)
    expect(isUnboundWidget(widget('timer', ''))).toBe(false)
  })

  it('counts across all pages', () => {
    const config = configWith([
      [widget('gauge', ''), widget('gauge', 'rpm')],
      [widget('gear', ''), widget('button', '')],
    ])
    expect(unboundWidgetCount(config)).toBe(2)
  })

  it('returns 0 for a null config', () => {
    expect(unboundWidgetCount(null)).toBe(0)
  })
})
