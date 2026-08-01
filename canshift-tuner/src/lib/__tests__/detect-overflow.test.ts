import { describe, expect, it } from 'vitest'
import type { DashboardConfig } from '@tmbk/canshift-core'
import { detectOverflow } from '../detect-overflow'

interface SpanWidget {
  id: string
  col: number
  colSpan: number
  row: number
  rowSpan: number
}

const makeConfig = (
  widgets: SpanWidget[],
  targetProfile: DashboardConfig['targetProfile'] = 'crowpanel-28'
): DashboardConfig =>
  ({
    version: '1.25.0',
    name: 't',
    revLimitRpm: 7000,
    targetProfile,
    defaultPageId: 'p1',
    topBar: {
      height: 24,
      backgroundColor: '#000000',
      items: [],
    },
    pages: [
      {
        id: 'p1',
        backgroundColor: '#000000',
        widgets: widgets.map((w) => ({
          id: w.id,
          type: 'label',
          layout: { col: w.col, colSpan: w.colSpan, row: w.row, rowSpan: w.rowSpan, zOrder: 0 },
          style: {},
          config: { text: '' },
        })),
        palette: {
          textColor: '#FFFFFF',
          accentColor: '#FF0000',
          warningColor: '#FFAA00',
          dangerColor: '#FF0000',
          dimColor: '#888888',
        },
        showTopBar: true,
        visible: true,
      },
    ],
  }) as unknown as DashboardConfig

describe('detectOverflow', () => {
  it('returns empty for widgets inside the 12-column grid', () => {
    const cfg = makeConfig([{ id: 'w1', col: 0, colSpan: 6, row: 0, rowSpan: 6 }])
    expect(detectOverflow(cfg)).toHaveLength(0)
  })

  it('flags column span past the right edge', () => {
    const cfg = makeConfig([{ id: 'w1', col: 8, colSpan: 6, row: 0, rowSpan: 2 }])
    const out = detectOverflow(cfg)
    expect(out).toHaveLength(1)
    expect(out[0]?.widgetId).toBe('w1')
  })

  it('flags row span past the bottom edge', () => {
    const cfg = makeConfig([{ id: 'w1', col: 0, colSpan: 2, row: 10, rowSpan: 4 }])
    expect(detectOverflow(cfg)).toHaveLength(1)
  })

  it('flags negative track coordinates', () => {
    const cfg = makeConfig([{ id: 'w1', col: -1, colSpan: 2, row: 0, rowSpan: 2 }])
    expect(detectOverflow(cfg)).toHaveLength(1)
  })

  it('reports multiple offenders', () => {
    const cfg = makeConfig([
      { id: 'ok', col: 0, colSpan: 2, row: 0, rowSpan: 2 },
      { id: 'bad1', col: 11, colSpan: 4, row: 0, rowSpan: 2 },
      { id: 'bad2', col: 0, colSpan: 2, row: 11, rowSpan: 4 },
    ])
    expect(
      detectOverflow(cfg)
        .map((o) => o.widgetId)
        .sort()
    ).toEqual(['bad1', 'bad2'])
  })
})
