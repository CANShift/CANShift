// dashboard.store.test.ts — unit coverage for the widget-mutation paths
// (duplicate, undo, isDirty propagation). The full store has many actions
// — this file focuses on the ones recently added or risky to regress.

import { beforeEach, describe, expect, it } from 'vitest'
import type { DashboardConfig, Widget } from '@tmbk/canshift-core'
import { useDashboardStore } from './dashboard.store'

function makeWidget(id: string, overrides: Partial<Widget> = {}): Widget {
  return {
    id,
    type: 'gauge',
    signal: 'rpm',
    layout: { x: 0, y: 0, w: 160, h: 56, zOrder: 0 },
    style: {
      primaryColor: '#FF4444',
      secondaryColor: '#2A2A2A',
      warningColor: '#FF8800',
      criticalColor: '#FF4444',
      textColor: '#FFFFFF',
      fontSize: 22,
    },
    config: {
      type: 'gauge',
      displayStyle: 'numeric',
      minValue: 0,
      maxValue: 8000,
      warningLevel: 6500,
      dangerLevel: 7000,
      decimalPlaces: 0,
    },
    ...overrides,
  }
}

function makeConfig(widgets: Widget[]): DashboardConfig {
  return {
    version: '1.10.0',
    name: 'Test',
    description: '',
    defaultPageId: 'p1',
    revLimitRpm: 7000,
    topBar: {
      height: 16,
      bgColor: '#0D0D0D',
      textColor: '#AAAAAA',
    },
    pages: [
      {
        id: 'p1',
        backgroundImage: null,
        backgroundColor: '#000000',
        showTopBar: true,
        palette: {
          surface: '#1E1E1E',
          primary: '#FF4444',
          accent: '#FF8800',
          text: '#FFFFFF',
          textDim: '#888888',
          warning: '#FF8800',
          danger: '#FF4444',
          success: '#00CC44',
        },
        widgets,
      },
    ],
  }
}

function widgetsOnPage1(): Widget[] {
  const config = useDashboardStore.getState().config
  if (!config) throw new Error('config is null')
  const page = config.pages[0]
  if (!page) throw new Error('page is null')
  return page.widgets
}

describe('useDashboardStore.duplicateWidgets', () => {
  beforeEach(() => {
    // Reset the singleton store between tests — Zustand keeps state across files
    useDashboardStore.setState({
      config: null,
      filePath: null,
      isDirty: false,
      selectedPageId: null,
      selectedWidgetId: null,
      selectedWidgetIds: [],
      past: [],
      future: [],
      isPreviewDayMode: false,
    })
  })

  it('clones a single widget with a fresh id and selects the clone', () => {
    const src = makeWidget('rpm_a')
    useDashboardStore.getState().setConfig(makeConfig([src]))
    useDashboardStore.getState().selectWidget('rpm_a')

    useDashboardStore.getState().duplicateWidgets('p1', ['rpm_a'])

    const widgets = widgetsOnPage1()
    expect(widgets).toHaveLength(2)
    const [first, clone] = widgets
    expect(first?.id).toBe('rpm_a')
    expect(clone?.id).not.toBe('rpm_a')
    expect(clone?.signal).toBe('rpm')
    expect(useDashboardStore.getState().selectedWidgetId).toBe(clone?.id)
    expect(useDashboardStore.getState().isDirty).toBe(true)
  })

  it('places the clone below the source when there is room', () => {
    const src = makeWidget('rpm_a', {
      layout: { x: 0, y: 0, w: 160, h: 56, zOrder: 0 },
    })
    useDashboardStore.getState().setConfig(makeConfig([src]))

    useDashboardStore.getState().duplicateWidgets('p1', ['rpm_a'])

    const clone = widgetsOnPage1()[1]
    // Source is at (0,0,160,56). Below = (0, 56) — first candidate.
    expect(clone?.layout.x).toBe(0)
    expect(clone?.layout.y).toBe(56)
  })

  it('falls back to the right when below is occupied', () => {
    const src = makeWidget('rpm_a', { layout: { x: 0, y: 0, w: 160, h: 56, zOrder: 0 } })
    const blocker = makeWidget('block', {
      layout: { x: 0, y: 56, w: 160, h: 56, zOrder: 0 },
    })
    useDashboardStore.getState().setConfig(makeConfig([src, blocker]))

    useDashboardStore.getState().duplicateWidgets('p1', ['rpm_a'])

    const clone = widgetsOnPage1()[2]
    // Below is blocked, right = (160, 0)
    expect(clone?.layout.x).toBe(160)
    expect(clone?.layout.y).toBe(0)
  })

  it('clones every widget when given multiple ids', () => {
    const a = makeWidget('a', { layout: { x: 0, y: 0, w: 160, h: 56, zOrder: 0 } })
    const b = makeWidget('b', { layout: { x: 160, y: 0, w: 160, h: 56, zOrder: 0 } })
    useDashboardStore.getState().setConfig(makeConfig([a, b]))

    useDashboardStore.getState().duplicateWidgets('p1', ['a', 'b'])

    expect(widgetsOnPage1()).toHaveLength(4)
    expect(useDashboardStore.getState().selectedWidgetIds).toHaveLength(2)
  })

  it('is a no-op when the page is unknown', () => {
    const src = makeWidget('rpm_a')
    useDashboardStore.getState().setConfig(makeConfig([src]))
    const before = useDashboardStore.getState().config

    useDashboardStore.getState().duplicateWidgets('does_not_exist', ['rpm_a'])

    expect(useDashboardStore.getState().config).toEqual(before)
    expect(useDashboardStore.getState().isDirty).toBe(false)
  })

  it('is a no-op when no widget ids are provided', () => {
    const src = makeWidget('rpm_a')
    useDashboardStore.getState().setConfig(makeConfig([src]))

    useDashboardStore.getState().duplicateWidgets('p1', [])

    expect(widgetsOnPage1()).toHaveLength(1)
    expect(useDashboardStore.getState().isDirty).toBe(false)
  })

  it('undo restores the page to the pre-duplicate state', () => {
    const src = makeWidget('rpm_a')
    useDashboardStore.getState().setConfig(makeConfig([src]))

    useDashboardStore.getState().duplicateWidgets('p1', ['rpm_a'])
    expect(widgetsOnPage1()).toHaveLength(2)

    useDashboardStore.getState().undo()
    expect(widgetsOnPage1()).toHaveLength(1)
  })
})
