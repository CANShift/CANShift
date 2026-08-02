import { describe, it, expect, beforeEach } from 'vitest'
import { HexColorSchema } from '@tmbk/canshift-core'
import type { DashboardConfig, ScreenProfileId } from '@tmbk/canshift-core'
import { useDashboardStore } from '../dashboard.store'

const makeConfig = (): DashboardConfig =>
  ({
    version: '1.24.0',
    defaultPageId: 'p1',
    topBar: { height: 16, bgColor: '#000000', textColor: '#FFFFFF' },
    pages: [
      {
        id: 'p1',
        backgroundColor: '#000000',
        showTopBar: true,
        visible: true,
        widgets: [
          {
            id: 'gauge_a',
            type: 'gauge',
            signal: '',
            layout: { col: 0, colSpan: 4, row: 0, rowSpan: 3, zOrder: 0 },
          },
          {
            id: 'gauge_b',
            type: 'gauge',
            signal: '',
            layout: { col: 4, colSpan: 4, row: 0, rowSpan: 3, zOrder: 0 },
          },
        ],
      },
      { id: 'p2', backgroundColor: '#000000', showTopBar: true, visible: true, widgets: [] },
    ],
  }) as unknown as DashboardConfig

describe('undo/redo (#1742)', () => {
  beforeEach(() => {
    useDashboardStore.getState().setConfig(makeConfig())
  })

  it('starts with empty history after setConfig', () => {
    expect(useDashboardStore.getState().past).toHaveLength(0)
    expect(useDashboardStore.getState().future).toHaveLength(0)
  })

  it('round-trips a page removal', () => {
    const s = useDashboardStore.getState()
    s.removePage('p2')
    expect(useDashboardStore.getState().config?.pages).toHaveLength(1)
    expect(useDashboardStore.getState().past.length).toBeGreaterThan(0)

    useDashboardStore.getState().undo()
    expect(useDashboardStore.getState().config?.pages).toHaveLength(2)
    expect(useDashboardStore.getState().config?.pages[1]?.id).toBe('p2')

    useDashboardStore.getState().redo()
    expect(useDashboardStore.getState().config?.pages).toHaveLength(1)
  })

  it('round-trips a widget removal', () => {
    useDashboardStore.getState().removeWidgets('p1', ['gauge_a'])
    expect(useDashboardStore.getState().config?.pages[0]?.widgets).toHaveLength(1)

    useDashboardStore.getState().undo()
    const widgets = useDashboardStore.getState().config?.pages[0]?.widgets ?? []
    expect(widgets.map((w) => w.id)).toEqual(['gauge_a', 'gauge_b'])

    useDashboardStore.getState().redo()
    expect(useDashboardStore.getState().config?.pages[0]?.widgets).toHaveLength(1)
  })

  it('re-points selection when the selected page no longer exists after undo', () => {
    useDashboardStore.getState().selectPage('p2')
    useDashboardStore.getState().removePage('p2')
    useDashboardStore.getState().undo()
    const state = useDashboardStore.getState()
    expect(state.config?.pages.some((p) => p.id === state.selectedPageId)).toBe(true)
  })

  it('undo is a no-op with empty history', () => {
    const before = useDashboardStore.getState().config
    useDashboardStore.getState().undo()
    expect(useDashboardStore.getState().config).toBe(before)
  })
})

describe('labelled undo stack (#1847)', () => {
  beforeEach(() => {
    useDashboardStore.getState().setConfig(makeConfig())
  })

  const lastLabel = () => {
    const past = useDashboardStore.getState().past
    return past[past.length - 1]?.label
  }

  it('labels a widget deletion with the widget reference', () => {
    useDashboardStore.getState().removeWidget('p1', 'gauge_a')
    expect(lastLabel()).toBe('Deleted gauge')
  })

  it('labels a rebind with old and new signal', () => {
    useDashboardStore.getState().updateWidget('p1', 'gauge_a', { signal: 'rpm' })
    expect(lastLabel()).toBe('Rebound gauge to rpm')
  })

  it('labels page operations with the page number', () => {
    useDashboardStore.getState().removePage('p2')
    expect(lastLabel()).toBe('Deleted page 02')
  })

  it('labels a target-screen change and round-trips it', () => {
    const before = useDashboardStore.getState().config?.targetProfile
    useDashboardStore.getState().setTargetProfile('crowpanel-28' as ScreenProfileId)
    expect(lastLabel()).toBe('Changed target screen')
    useDashboardStore.getState().undo()
    expect(useDashboardStore.getState().config?.targetProfile).toBe(before)
  })

  it('labels theme changes and round-trips them', () => {
    useDashboardStore.getState().setNightTheme({ bgColor: HexColorSchema.parse('#101010') })
    expect(lastLabel()).toBe('Changed night theme')
    useDashboardStore.getState().undo()
    expect(useDashboardStore.getState().config?.nightTheme).toBeUndefined()
    useDashboardStore.getState().redo()
    expect(useDashboardStore.getState().config?.nightTheme?.bgColor).toBe('#101010')
  })

  it('keeps the label across undo and redo', () => {
    useDashboardStore.getState().removePage('p2')
    useDashboardStore.getState().undo()
    expect(useDashboardStore.getState().future[0]?.label).toBe('Deleted page 02')
    useDashboardStore.getState().redo()
    expect(lastLabel()).toBe('Deleted page 02')
  })

  it('a drag round-trips exactly: beginDrag snapshots before the live moves', () => {
    useDashboardStore.getState().beginDrag('p1', ['gauge_a'])
    expect(lastLabel()).toBe('Moved gauge')
    useDashboardStore.getState().moveWidget('p1', 'gauge_a', { col: 5, row: 5 })
    useDashboardStore.getState().moveWidget('p1', 'gauge_a', { col: 6, row: 7 })
    useDashboardStore.getState().undo()
    const w = useDashboardStore.getState().config?.pages[0]?.widgets[0]
    expect([w?.layout.col, w?.layout.row]).toEqual([0, 0])
    useDashboardStore.getState().redo()
    const w2 = useDashboardStore.getState().config?.pages[0]?.widgets[0]
    expect([w2?.layout.col, w2?.layout.row]).toEqual([6, 7])
  })

  it('nudge and align are labelled and revert', () => {
    useDashboardStore.getState().nudgeWidgets('p1', ['gauge_a'], 1, 0)
    expect(lastLabel()).toBe('Nudged gauge')
    useDashboardStore.getState().undo()
    useDashboardStore.getState().alignWidgets('p1', ['gauge_a', 'gauge_b'], 'left')
    expect(lastLabel()).toBe('Aligned 2 widgets left')
  })

  it('caps the stack at 100 entries, dropping the oldest', () => {
    for (let i = 0; i < 110; i++) {
      useDashboardStore.getState().setDefaultPage(i % 2 === 0 ? 'p1' : 'p2')
    }
    const past = useDashboardStore.getState().past
    expect(past).toHaveLength(100)
    expect(past[0]?.label).toBe('Set page 01 as default')
    expect(past[0]?.config.defaultPageId).toBe('p2')
  })
})
