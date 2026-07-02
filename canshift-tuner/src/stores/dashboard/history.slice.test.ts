import { describe, it, expect, beforeEach } from 'vitest'
import type { DashboardConfig } from '@tmbk/canshift-core'
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
          { id: 'gauge_a', type: 'gauge' },
          { id: 'gauge_b', type: 'gauge' },
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
