import { describe, expect, it } from 'vitest'
import type { DashboardConfig } from '@tmbk/canshift-core'
import { detectOverflow } from '../detect-overflow'

const makeConfig = (
  widgets: Array<{ id: string; x: number; y: number; w: number; h: number }>,
  targetProfile: DashboardConfig['targetProfile'] = 'crowpanel-28'
): DashboardConfig =>
  ({
    version: '1.0.0',
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
          layout: { x: w.x, y: w.y, w: w.w, h: w.h, z: 0 },
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
  it('returns empty for in-bounds widgets on crowpanel_28 (320×240)', () => {
    const cfg = makeConfig([{ id: 'w1', x: 10, y: 10, w: 100, h: 100 }])
    expect(detectOverflow(cfg)).toHaveLength(0)
  })

  it('flags right-edge overflow', () => {
    const cfg = makeConfig([{ id: 'w1', x: 200, y: 10, w: 200, h: 50 }])
    const out = detectOverflow(cfg)
    expect(out).toHaveLength(1)
    expect(out[0]?.widgetId).toBe('w1')
  })

  it('flags bottom-edge overflow', () => {
    const cfg = makeConfig([{ id: 'w1', x: 10, y: 200, w: 50, h: 100 }])
    const out = detectOverflow(cfg)
    expect(out).toHaveLength(1)
  })

  it('flags negative coords', () => {
    const cfg = makeConfig([{ id: 'w1', x: -5, y: 10, w: 50, h: 50 }])
    expect(detectOverflow(cfg)).toHaveLength(1)
  })

  it('reports multiple offenders', () => {
    const cfg = makeConfig([
      { id: 'ok', x: 0, y: 0, w: 50, h: 50 },
      { id: 'bad1', x: 400, y: 0, w: 50, h: 50 },
      { id: 'bad2', x: 0, y: 400, w: 50, h: 50 },
    ])
    expect(
      detectOverflow(cfg)
        .map((o) => o.widgetId)
        .sort()
    ).toEqual(['bad1', 'bad2'])
  })
})
