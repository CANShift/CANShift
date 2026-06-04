// stores/__tests__/dashboard-history.test.ts — Coverage for the dashboard
// store's undo / redo invariants (#1077 follow-up).
//
// The existing `dashboard-theme.test.ts` exercises a single action through
// the history; this suite focuses on the past/future stacks themselves —
// LIFO ordering, HISTORY_LIMIT cap (50), redo clearing on new edits, and
// the resilience of `selectedPageId` when undo lands on a config that no
// longer contains the previously selected page.
//
// Vitest runs in `node` environment per `vitest.config.ts`. We re-seed the
// store with a deep-cloned `DEFAULT_SIM_CONFIG` between tests so a mutation
// in one case doesn't bleed into the next.

import { beforeEach, describe, expect, it } from 'vitest'
import type { DashboardConfig, PageConfig, Widget } from '@tmbk/canshift-core'
import { useDashboardStore } from '../dashboard.store'
import { DEFAULT_SIM_CONFIG } from '../../config/defaultSimConfig'

function freshConfig(): DashboardConfig {
  return JSON.parse(JSON.stringify(DEFAULT_SIM_CONFIG)) as DashboardConfig
}

function newPage(id: string): PageConfig {
  return {
    id,
    backgroundImage: null,
    backgroundColor: '#000000',
    showTopBar: true,
    widgets: [],
  } as unknown as PageConfig
}

function newWidget(id: string): Widget {
  return {
    id,
    type: 'text',
    signal: null,
    layout: { x: 0, y: 0, w: 80, h: 28, zOrder: 0 },
    style: {
      primaryColor: '#FFFFFF',
      secondaryColor: '#2A2A2A',
      warningColor: '#FF8800',
      criticalColor: '#FF4444',
      textColor: '#FFFFFF',
      fontSize: 16,
    },
    config: { type: 'text', text: id, align: 'left' },
  } as unknown as Widget
}

describe('dashboard.store — history invariants', () => {
  beforeEach(() => {
    useDashboardStore.getState().setConfig(freshConfig())
  })

  it('setConfig resets both past and future', () => {
    // First, build up some history.
    useDashboardStore.getState().addPage(newPage('extra-1'))
    useDashboardStore.getState().undo()
    expect(useDashboardStore.getState().past.length).toBe(0)
    expect(useDashboardStore.getState().future.length).toBe(1)

    useDashboardStore.getState().setConfig(freshConfig())
    const state = useDashboardStore.getState()
    expect(state.past).toEqual([])
    expect(state.future).toEqual([])
    expect(state.isDirty).toBe(false)
  })

  it('a new mutation clears the redo stack', () => {
    useDashboardStore.getState().addPage(newPage('p1'))
    useDashboardStore.getState().undo()
    expect(useDashboardStore.getState().future.length).toBe(1)

    useDashboardStore.getState().addPage(newPage('p2'))
    expect(useDashboardStore.getState().future).toEqual([])
  })

  it('undo with an empty past is a safe no-op', () => {
    const before = useDashboardStore.getState()
    expect(before.past.length).toBe(0)

    useDashboardStore.getState().undo()
    const after = useDashboardStore.getState()
    expect(after.config).toEqual(before.config)
    expect(after.past.length).toBe(0)
    expect(after.future.length).toBe(0)
  })

  it('redo with an empty future is a safe no-op', () => {
    const before = useDashboardStore.getState()
    useDashboardStore.getState().redo()
    const after = useDashboardStore.getState()
    expect(after.config).toEqual(before.config)
    expect(after.future.length).toBe(0)
  })

  it('undo then redo round-trips the config and preserves stack sizes', () => {
    const initialPageCount = useDashboardStore.getState().config?.pages.length ?? 0
    useDashboardStore.getState().addPage(newPage('round-trip'))

    const afterAdd = JSON.parse(JSON.stringify(useDashboardStore.getState().config))
    expect(afterAdd.pages.length).toBe(initialPageCount + 1)

    useDashboardStore.getState().undo()
    expect(useDashboardStore.getState().config?.pages.length).toBe(initialPageCount)
    expect(useDashboardStore.getState().future.length).toBe(1)

    useDashboardStore.getState().redo()
    expect(useDashboardStore.getState().config).toEqual(afterAdd)
    expect(useDashboardStore.getState().future.length).toBe(0)
  })

  it('caps the past stack at HISTORY_LIMIT (50) by dropping the oldest entry', () => {
    // 60 mutations — only the last 50 should survive.
    for (let i = 0; i < 60; i++) {
      useDashboardStore.getState().addPage(newPage(`p-${String(i)}`))
    }
    expect(useDashboardStore.getState().past.length).toBe(50)
  })

  it('caps the future stack at HISTORY_LIMIT (50) when undo-ing past the cap', () => {
    for (let i = 0; i < 60; i++) {
      useDashboardStore.getState().addPage(newPage(`p-${String(i)}`))
    }
    // Walk back through every available past entry.
    while (useDashboardStore.getState().past.length > 0) {
      useDashboardStore.getState().undo()
    }
    expect(useDashboardStore.getState().future.length).toBe(50)
  })

  it('marks isDirty after an undo (you have unsaved diverging history)', () => {
    useDashboardStore.getState().addPage(newPage('div-1'))
    useDashboardStore.getState().markSaved('/tmp/foo.json')
    expect(useDashboardStore.getState().isDirty).toBe(false)

    useDashboardStore.getState().undo()
    expect(useDashboardStore.getState().isDirty).toBe(true)
  })

  it('undo restores selectedPageId to a still-existing page when the previous selection was removed', () => {
    useDashboardStore.getState().addPage(newPage('temp'))
    useDashboardStore.getState().selectPage('temp')
    expect(useDashboardStore.getState().selectedPageId).toBe('temp')

    // The undo will roll back to a config WITHOUT `temp` while the selection
    // still points at it — the store has to repair selectedPageId.
    useDashboardStore.getState().undo()
    const state = useDashboardStore.getState()
    expect(state.config?.pages.some((p) => p.id === 'temp')).toBe(false)
    expect(state.selectedPageId).not.toBe('temp')
    expect(state.selectedPageId).toBe(state.config?.pages[0]?.id ?? null)
  })

  it('undo clears the widget multi-selection', () => {
    const pageId = useDashboardStore.getState().config?.defaultPageId ?? ''
    useDashboardStore.getState().addWidget(pageId, newWidget('w-new'))
    useDashboardStore.getState().selectWidgets(['w-new', 'speed_arc'])
    expect(useDashboardStore.getState().selectedWidgetIds.length).toBe(2)

    useDashboardStore.getState().undo()
    const after = useDashboardStore.getState()
    expect(after.selectedWidgetId).toBeNull()
    expect(after.selectedWidgetIds).toEqual([])
  })

  it('no-op setTargetProfile (same value) does NOT push a history entry', () => {
    // Seed an explicit profile so the second call truly hits the no-op guard.
    useDashboardStore.getState().setTargetProfile('crowpanel-28')
    const pastAfterSeed = useDashboardStore.getState().past.length

    useDashboardStore.getState().setTargetProfile('crowpanel-28')
    expect(useDashboardStore.getState().past.length).toBe(pastAfterSeed)
  })

  it('setTargetProfile is undo-able and toggles isDirty', () => {
    const before = useDashboardStore.getState().config?.targetProfile
    useDashboardStore.getState().setTargetProfile('crowpanel-28')
    expect(useDashboardStore.getState().config?.targetProfile).toBe('crowpanel-28')
    expect(useDashboardStore.getState().isDirty).toBe(true)

    useDashboardStore.getState().undo()
    expect(useDashboardStore.getState().config?.targetProfile).toBe(before)
  })

  it('updateWidget clamps layout to the active target-screen profile bounds', () => {
    // Default profile is 320×240 → widget area is 320 × (240 - topBar.height).
    // Push a widget's origin past the right edge — store must clamp it back to
    // the canvas, not silently keep an off-canvas value. Issue #548.
    const pageId = useDashboardStore.getState().config?.defaultPageId ?? ''
    const targetWidget = useDashboardStore.getState().config?.pages.find((p) => p.id === pageId)
      ?.widgets[0]
    expect(targetWidget).toBeDefined()
    if (!targetWidget) return

    useDashboardStore.getState().updateWidget(pageId, targetWidget.id, {
      layout: { ...targetWidget.layout, x: 1000, y: 1000 },
    })
    const after = useDashboardStore
      .getState()
      .config?.pages.find((p) => p.id === pageId)
      ?.widgets.find((w) => w.id === targetWidget.id)
    expect(after).toBeDefined()
    if (!after) return
    expect(after.layout.x).toBeLessThanOrEqual(320 - after.layout.w)
    expect(after.layout.x).toBeGreaterThanOrEqual(0)
  })
})
