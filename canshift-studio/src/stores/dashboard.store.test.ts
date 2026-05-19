// dashboard.store.test.ts — unit coverage for the widget-mutation paths
// (duplicate, undo, isDirty propagation). The full store has many actions
// — this file focuses on the ones recently added or risky to regress.

import { beforeEach, describe, expect, it } from 'vitest'
import type { DashboardConfig, PageConfig, ThemePreset, Widget } from '@tmbk/canshift-core'
import { useDashboardStore } from './dashboard.store'
import { DEFAULT_SIM_CONFIG } from '../config/defaultSimConfig'

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
      loadedFromDemoFallback: false,
      pendingDeviceConfig: null,
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

describe('useDashboardStore.loadImported', () => {
  beforeEach(() => {
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
      loadedFromDemoFallback: false,
      pendingDeviceConfig: null,
    })
  })

  it('replaces the config, clears filePath, and marks dirty', () => {
    // Start from a saved working file so we can verify it gets cleared
    useDashboardStore.getState().setConfig(makeConfig([makeWidget('rpm_a')]), '/tmp/existing.json')
    expect(useDashboardStore.getState().filePath).toBe('/tmp/existing.json')
    expect(useDashboardStore.getState().isDirty).toBe(false)

    const imported = makeConfig([makeWidget('imported_w')])
    useDashboardStore.getState().loadImported(imported)

    const state = useDashboardStore.getState()
    expect(state.config).toBe(imported)
    expect(state.filePath).toBeNull()
    expect(state.isDirty).toBe(true)
    expect(state.past).toHaveLength(0)
    expect(state.future).toHaveLength(0)
    expect(state.selectedPageId).toBe(imported.defaultPageId)
  })
})

describe('useDashboardStore.loadFromDeviceOrDemo', () => {
  beforeEach(() => {
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
      loadedFromDemoFallback: false,
      pendingDeviceConfig: null,
    })
  })

  it('loads DEFAULT_SIM_CONFIG when editor is empty and no device config is provided', () => {
    const outcome = useDashboardStore.getState().loadFromDeviceOrDemo(null)

    expect(outcome).toBe('demo')
    const state = useDashboardStore.getState()
    expect(state.config).toBe(DEFAULT_SIM_CONFIG)
    expect(state.filePath).toBeNull()
    expect(state.isDirty).toBe(false)
    expect(state.selectedPageId).toBe(DEFAULT_SIM_CONFIG.defaultPageId)
  })

  it('loads the device config when the editor is empty', () => {
    const device = makeConfig([makeWidget('device_w')])

    const outcome = useDashboardStore.getState().loadFromDeviceOrDemo(device)

    expect(outcome).toBe('device')
    const state = useDashboardStore.getState()
    expect(state.config).toBe(device)
    expect(state.isDirty).toBe(false)
    expect(state.selectedPageId).toBe(device.defaultPageId)
  })

  it('keeps the user edits when device returns null and editor already has a config', () => {
    const userEdits = makeConfig([makeWidget('user_edit')])
    useDashboardStore.getState().setConfig(userEdits)
    // Simulate an in-progress edit having dirtied the store.
    useDashboardStore.setState({ isDirty: true })

    const outcome = useDashboardStore.getState().loadFromDeviceOrDemo(null)

    expect(outcome).toBe('kept-edits')
    const state = useDashboardStore.getState()
    expect(state.config).toBe(userEdits)
    expect(state.isDirty).toBe(true)
  })

  it('lets the device config win over user edits (device is the source of truth on connect)', () => {
    const userEdits = makeConfig([makeWidget('user_edit')])
    useDashboardStore.getState().setConfig(userEdits)
    useDashboardStore.setState({ isDirty: true })

    const device = makeConfig([makeWidget('device_w')])
    const outcome = useDashboardStore.getState().loadFromDeviceOrDemo(device)

    expect(outcome).toBe('device')
    const state = useDashboardStore.getState()
    expect(state.config).toBe(device)
    expect(state.isDirty).toBe(false)
  })

  it('reads the LATEST state, not a stale closure (regression test for #216)', () => {
    // Capture the action ONCE — the bug pattern was a callsite that read
    // `state.config` via a closure captured before the user typed something.
    const action = useDashboardStore.getState().loadFromDeviceOrDemo

    // After the action reference was captured, the user starts editing.
    const userEdits = makeConfig([makeWidget('mid_edit')])
    useDashboardStore.getState().setConfig(userEdits)
    useDashboardStore.setState({ isDirty: true })

    // Device returns null — must observe the new state and keep edits.
    const outcome = action(null)

    expect(outcome).toBe('kept-edits')
    expect(useDashboardStore.getState().config).toBe(userEdits)
  })

  it('marks loadedFromDemoFallback when seeding the demo for an empty editor (#418)', () => {
    useDashboardStore.getState().loadFromDeviceOrDemo(null)

    expect(useDashboardStore.getState().loadedFromDemoFallback).toBe(true)
    expect(useDashboardStore.getState().pendingDeviceConfig).toBeNull()
  })

  it('clears loadedFromDemoFallback when a real device config eventually lands', () => {
    // First call seeds the demo (editor was empty).
    useDashboardStore.getState().loadFromDeviceOrDemo(null)
    expect(useDashboardStore.getState().loadedFromDemoFallback).toBe(true)

    // Second call replaces the demo with a real device config.
    const device = makeConfig([makeWidget('device_w')])
    useDashboardStore.getState().loadFromDeviceOrDemo(device)

    expect(useDashboardStore.getState().loadedFromDemoFallback).toBe(false)
    expect(useDashboardStore.getState().pendingDeviceConfig).toBeNull()
    expect(useDashboardStore.getState().config).toBe(device)
  })

  it('does NOT mark loadedFromDemoFallback when keeping in-progress edits', () => {
    const userEdits = makeConfig([makeWidget('user_edit')])
    useDashboardStore.getState().setConfig(userEdits)

    useDashboardStore.getState().loadFromDeviceOrDemo(null)

    expect(useDashboardStore.getState().loadedFromDemoFallback).toBe(false)
  })
})

describe('useDashboardStore.pendingDeviceConfig (#418 post-recovery prompt)', () => {
  beforeEach(() => {
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
      loadedFromDemoFallback: false,
      pendingDeviceConfig: null,
    })
  })

  it('stagePendingDeviceConfig parks the config without touching the editor', () => {
    // Editor is showing the demo as a fallback.
    useDashboardStore.getState().loadFromDeviceOrDemo(null)
    const demoConfig = useDashboardStore.getState().config

    const incoming = makeConfig([makeWidget('device_w')])
    useDashboardStore.getState().stagePendingDeviceConfig(incoming)

    const state = useDashboardStore.getState()
    expect(state.pendingDeviceConfig).toBe(incoming)
    // Editor still shows the demo, untouched.
    expect(state.config).toBe(demoConfig)
    expect(state.loadedFromDemoFallback).toBe(true)
  })

  it('acceptPendingDeviceConfig swaps the demo for the staged config', () => {
    useDashboardStore.getState().loadFromDeviceOrDemo(null)
    const incoming = makeConfig([makeWidget('device_w')])
    useDashboardStore.getState().stagePendingDeviceConfig(incoming)

    useDashboardStore.getState().acceptPendingDeviceConfig()

    const state = useDashboardStore.getState()
    expect(state.config).toBe(incoming)
    expect(state.pendingDeviceConfig).toBeNull()
    expect(state.loadedFromDemoFallback).toBe(false)
    expect(state.isDirty).toBe(false)
  })

  it('acceptPendingDeviceConfig is a no-op when nothing is staged', () => {
    useDashboardStore.getState().loadFromDeviceOrDemo(null)
    const before = useDashboardStore.getState().config

    useDashboardStore.getState().acceptPendingDeviceConfig()

    expect(useDashboardStore.getState().config).toBe(before)
    expect(useDashboardStore.getState().loadedFromDemoFallback).toBe(true)
  })

  it('dismissPendingDeviceConfig clears the prompt but keeps the demo flag', () => {
    useDashboardStore.getState().loadFromDeviceOrDemo(null)
    const incoming = makeConfig([makeWidget('device_w')])
    useDashboardStore.getState().stagePendingDeviceConfig(incoming)

    useDashboardStore.getState().dismissPendingDeviceConfig()

    const state = useDashboardStore.getState()
    expect(state.pendingDeviceConfig).toBeNull()
    // Still on the demo — and the flag stays so a *later* probe can re-prompt.
    expect(state.loadedFromDemoFallback).toBe(true)
  })

  it('setConfig clears every demo-fallback flag (user explicitly opens a config)', () => {
    useDashboardStore.getState().loadFromDeviceOrDemo(null)
    const incoming = makeConfig([makeWidget('device_w')])
    useDashboardStore.getState().stagePendingDeviceConfig(incoming)

    const opened = makeConfig([makeWidget('opened_w')])
    useDashboardStore.getState().setConfig(opened, '/tmp/file.json')

    const state = useDashboardStore.getState()
    expect(state.loadedFromDemoFallback).toBe(false)
    expect(state.pendingDeviceConfig).toBeNull()
    expect(state.config).toBe(opened)
  })

  it('loadImported clears every demo-fallback flag', () => {
    useDashboardStore.getState().loadFromDeviceOrDemo(null)
    const incoming = makeConfig([makeWidget('device_w')])
    useDashboardStore.getState().stagePendingDeviceConfig(incoming)

    const imported = makeConfig([makeWidget('imported_w')])
    useDashboardStore.getState().loadImported(imported)

    const state = useDashboardStore.getState()
    expect(state.loadedFromDemoFallback).toBe(false)
    expect(state.pendingDeviceConfig).toBeNull()
    expect(state.config).toBe(imported)
  })
})

function resetStore(): void {
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
    loadedFromDemoFallback: false,
    pendingDeviceConfig: null,
  })
}

describe('useDashboardStore.markSaved', () => {
  beforeEach(resetStore)

  it('records the file path and clears the dirty flag', () => {
    useDashboardStore.getState().setConfig(makeConfig([makeWidget('a')]))
    useDashboardStore.setState({ isDirty: true })

    useDashboardStore.getState().markSaved('/tmp/saved.json')

    const state = useDashboardStore.getState()
    expect(state.filePath).toBe('/tmp/saved.json')
    expect(state.isDirty).toBe(false)
  })
})

describe('useDashboardStore — undo / redo', () => {
  beforeEach(resetStore)

  it('undo() is a no-op when there is no history', () => {
    useDashboardStore.getState().setConfig(makeConfig([makeWidget('a')]))
    const before = useDashboardStore.getState().config

    useDashboardStore.getState().undo()
    expect(useDashboardStore.getState().config).toBe(before)
  })

  it('redo() is a no-op when nothing has been undone', () => {
    useDashboardStore.getState().setConfig(makeConfig([makeWidget('a')]))
    const before = useDashboardStore.getState().config

    useDashboardStore.getState().redo()
    expect(useDashboardStore.getState().config).toBe(before)
  })

  it('redo() restores the most recent undone state', () => {
    useDashboardStore.getState().setConfig(makeConfig([makeWidget('a')]))
    useDashboardStore.getState().addPage({
      id: 'p2',
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
      widgets: [],
    })
    expect(useDashboardStore.getState().config?.pages).toHaveLength(2)

    useDashboardStore.getState().undo()
    expect(useDashboardStore.getState().config?.pages).toHaveLength(1)

    useDashboardStore.getState().redo()
    expect(useDashboardStore.getState().config?.pages).toHaveLength(2)
  })

  it('undo() resets selectedPageId when the prior state lacked the current page', () => {
    useDashboardStore.getState().setConfig(makeConfig([makeWidget('a')]))
    const newPage: PageConfig = {
      id: 'p2',
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
      widgets: [],
    }
    useDashboardStore.getState().addPage(newPage)
    expect(useDashboardStore.getState().selectedPageId).toBe('p2')

    useDashboardStore.getState().undo()
    expect(useDashboardStore.getState().selectedPageId).toBe('p1')
  })
})

describe('useDashboardStore — page operations', () => {
  beforeEach(resetStore)

  function newPage(id: string): import('@tmbk/canshift-core').PageConfig {
    return {
      id,
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
      widgets: [],
    }
  }

  it('selectPage() sets the page and clears widget selection', () => {
    useDashboardStore.getState().setConfig(makeConfig([makeWidget('a')]))
    useDashboardStore.getState().selectWidget('a')

    useDashboardStore.getState().selectPage('p2')

    const state = useDashboardStore.getState()
    expect(state.selectedPageId).toBe('p2')
    expect(state.selectedWidgetId).toBeNull()
    expect(state.selectedWidgetIds).toEqual([])
  })

  it('addPage() appends and selects the new page', () => {
    useDashboardStore.getState().setConfig(makeConfig([makeWidget('a')]))

    useDashboardStore.getState().addPage(newPage('p2'))

    const state = useDashboardStore.getState()
    expect(state.config?.pages).toHaveLength(2)
    expect(state.selectedPageId).toBe('p2')
    expect(state.isDirty).toBe(true)
  })

  it('addPage() is a no-op when no config is loaded', () => {
    useDashboardStore.getState().addPage(newPage('p2'))
    expect(useDashboardStore.getState().config).toBeNull()
  })

  it('removePage() drops the matching page and re-selects the first remaining', () => {
    useDashboardStore.getState().setConfig(makeConfig([makeWidget('a')]))
    useDashboardStore.getState().addPage(newPage('p2'))

    useDashboardStore.getState().removePage('p2')

    const state = useDashboardStore.getState()
    expect(state.config?.pages.map((p) => p.id)).toEqual(['p1'])
    expect(state.selectedPageId).toBe('p1')
  })

  it('removePage() leaves selectedPageId as null when the last page is removed', () => {
    useDashboardStore.getState().setConfig(makeConfig([makeWidget('a')]))
    useDashboardStore.getState().removePage('p1')

    expect(useDashboardStore.getState().selectedPageId).toBeNull()
  })

  it('removePage() is a no-op without a config', () => {
    useDashboardStore.getState().removePage('p1')
    expect(useDashboardStore.getState().config).toBeNull()
  })

  it('setDefaultPage() updates the default and marks dirty', () => {
    useDashboardStore.getState().setConfig(makeConfig([makeWidget('a')]))
    useDashboardStore.getState().addPage(newPage('p2'))

    useDashboardStore.getState().setDefaultPage('p2')

    expect(useDashboardStore.getState().config?.defaultPageId).toBe('p2')
    expect(useDashboardStore.getState().isDirty).toBe(true)
  })

  it('setDefaultPage() is a no-op without a config', () => {
    useDashboardStore.getState().setDefaultPage('p1')
    expect(useDashboardStore.getState().config).toBeNull()
  })

  it('updatePage() applies a partial patch', () => {
    useDashboardStore.getState().setConfig(makeConfig([makeWidget('a')]))

    useDashboardStore.getState().updatePage('p1', { backgroundColor: '#123456' })

    expect(useDashboardStore.getState().config?.pages[0]?.backgroundColor).toBe('#123456')
  })

  it('updatePage() is a no-op when the page id is unknown', () => {
    useDashboardStore.getState().setConfig(makeConfig([makeWidget('a')]))
    const before = useDashboardStore.getState().config

    useDashboardStore.getState().updatePage('does_not_exist', { backgroundColor: '#000' })

    // No-op for unknown ids — config stays equivalent
    expect(useDashboardStore.getState().config?.pages[0]?.backgroundColor).toBe(
      before?.pages[0]?.backgroundColor
    )
  })

  it('updatePage() is a no-op without a config', () => {
    useDashboardStore.getState().updatePage('p1', { backgroundColor: '#000' })
    expect(useDashboardStore.getState().config).toBeNull()
  })

  it('movePage() reorders pages in-place', () => {
    useDashboardStore.getState().setConfig(makeConfig([makeWidget('a')]))
    useDashboardStore.getState().addPage(newPage('p2'))
    useDashboardStore.getState().addPage(newPage('p3'))

    useDashboardStore.getState().movePage(0, 2)

    expect(useDashboardStore.getState().config?.pages.map((p) => p.id)).toEqual(['p2', 'p3', 'p1'])
  })

  it('movePage() rejects out-of-bounds indices', () => {
    useDashboardStore.getState().setConfig(makeConfig([makeWidget('a')]))
    const before = useDashboardStore.getState().config?.pages.map((p) => p.id)

    useDashboardStore.getState().movePage(-1, 0)
    useDashboardStore.getState().movePage(0, 99)

    expect(useDashboardStore.getState().config?.pages.map((p) => p.id)).toEqual(before)
  })

  it('movePage() is a no-op without a config', () => {
    useDashboardStore.getState().movePage(0, 1)
    expect(useDashboardStore.getState().config).toBeNull()
  })

  it('updateTopBar() merges a partial patch', () => {
    useDashboardStore.getState().setConfig(makeConfig([makeWidget('a')]))

    useDashboardStore.getState().updateTopBar({ height: 24 })

    const topBar = useDashboardStore.getState().config?.topBar
    expect(topBar?.height).toBe(24)
    // Untouched keys stay
    expect(topBar?.bgColor).toBe('#0D0D0D')
  })

  it('updateTopBar() is a no-op without a config', () => {
    useDashboardStore.getState().updateTopBar({ height: 30 })
    expect(useDashboardStore.getState().config).toBeNull()
  })
})

describe('useDashboardStore — theme', () => {
  beforeEach(resetStore)

  it('togglePreviewTheme() flips the boolean', () => {
    expect(useDashboardStore.getState().isPreviewDayMode).toBe(false)
    useDashboardStore.getState().togglePreviewTheme()
    expect(useDashboardStore.getState().isPreviewDayMode).toBe(true)
    useDashboardStore.getState().togglePreviewTheme()
    expect(useDashboardStore.getState().isPreviewDayMode).toBe(false)
  })

  it('setDayTheme() saves a preset', () => {
    useDashboardStore.getState().setConfig(makeConfig([makeWidget('a')]))
    const theme: ThemePreset = {
      bgColor: '#FFFFFF',
      palette: {
        surface: '#FFFFFF',
        primary: '#000000',
        accent: '#FFAA00',
        text: '#000000',
        textDim: '#888888',
        warning: '#FF8800',
        danger: '#CC0000',
        success: '#00CC44',
      },
    }

    useDashboardStore.getState().setDayTheme(theme)

    expect(useDashboardStore.getState().config?.dayTheme).toEqual(theme)
    expect(useDashboardStore.getState().isDirty).toBe(true)
  })

  it('setDayTheme(null) deletes the preset', () => {
    useDashboardStore.getState().setConfig(makeConfig([makeWidget('a')]))
    const theme: ThemePreset = {
      bgColor: '#FFFFFF',
      palette: {
        surface: '#FFFFFF',
        primary: '#000000',
        accent: '#FFAA00',
        text: '#000000',
        textDim: '#888888',
        warning: '#FF8800',
        danger: '#CC0000',
        success: '#00CC44',
      },
    }
    useDashboardStore.getState().setDayTheme(theme)
    expect(useDashboardStore.getState().config?.dayTheme).toBeDefined()

    useDashboardStore.getState().setDayTheme(null)

    expect(useDashboardStore.getState().config?.dayTheme).toBeUndefined()
  })

  it('setDayTheme() is a no-op without a config', () => {
    useDashboardStore.getState().setDayTheme(null)
    expect(useDashboardStore.getState().config).toBeNull()
  })
})

describe('useDashboardStore — selection', () => {
  beforeEach(resetStore)

  it('selectWidget(null) clears the selection', () => {
    useDashboardStore.getState().setConfig(makeConfig([makeWidget('a'), makeWidget('b')]))
    useDashboardStore.getState().selectWidget('a')
    useDashboardStore.getState().selectWidget(null)

    const state = useDashboardStore.getState()
    expect(state.selectedWidgetId).toBeNull()
    expect(state.selectedWidgetIds).toEqual([])
  })

  it('selectWidgets() replaces the multi-selection', () => {
    useDashboardStore.getState().setConfig(makeConfig([makeWidget('a'), makeWidget('b')]))

    useDashboardStore.getState().selectWidgets(['a', 'b'])

    const state = useDashboardStore.getState()
    expect(state.selectedWidgetIds).toEqual(['a', 'b'])
    // Last id in the list becomes the "primary" selection.
    expect(state.selectedWidgetId).toBe('b')
  })

  it('selectWidgets([]) clears every selection field', () => {
    useDashboardStore.getState().setConfig(makeConfig([makeWidget('a')]))
    useDashboardStore.getState().selectWidget('a')

    useDashboardStore.getState().selectWidgets([])

    const state = useDashboardStore.getState()
    expect(state.selectedWidgetId).toBeNull()
    expect(state.selectedWidgetIds).toEqual([])
  })

  it('toggleWidgetSelection() adds an unselected id', () => {
    useDashboardStore.getState().setConfig(makeConfig([makeWidget('a')]))

    useDashboardStore.getState().toggleWidgetSelection('a')

    expect(useDashboardStore.getState().selectedWidgetIds).toEqual(['a'])
  })

  it('toggleWidgetSelection() removes a selected id', () => {
    useDashboardStore.getState().setConfig(makeConfig([makeWidget('a'), makeWidget('b')]))
    useDashboardStore.getState().selectWidgets(['a', 'b'])

    useDashboardStore.getState().toggleWidgetSelection('a')

    const state = useDashboardStore.getState()
    expect(state.selectedWidgetIds).toEqual(['b'])
    expect(state.selectedWidgetId).toBe('b')
  })

  it('toggleWidgetSelection() leaves selectedWidgetId null when last toggle empties the set', () => {
    useDashboardStore.getState().setConfig(makeConfig([makeWidget('a')]))
    useDashboardStore.getState().selectWidgets(['a'])

    useDashboardStore.getState().toggleWidgetSelection('a')

    const state = useDashboardStore.getState()
    expect(state.selectedWidgetIds).toEqual([])
    expect(state.selectedWidgetId).toBeNull()
  })
})

describe('useDashboardStore — widget mutations', () => {
  beforeEach(resetStore)

  it('addWidget() places near the selected reference widget when there is room', () => {
    useDashboardStore
      .getState()
      .setConfig(
        makeConfig([makeWidget('ref', { layout: { x: 0, y: 0, w: 80, h: 56, zOrder: 0 } })])
      )
    useDashboardStore.getState().selectWidget('ref')

    useDashboardStore
      .getState()
      .addWidget('p1', makeWidget('new', { layout: { x: 999, y: 999, w: 80, h: 56, zOrder: 0 } }))

    const widgets = useDashboardStore.getState().config?.pages[0]?.widgets ?? []
    expect(widgets).toHaveLength(2)
    const placed = widgets.find((w) => w.id === 'new')
    expect(placed?.layout.x).toBe(80)
    expect(placed?.layout.y).toBe(0)
    expect(useDashboardStore.getState().selectedWidgetId).toBe('new')
  })

  it('addWidget() falls back to autoPlace when no reference widget is selected', () => {
    useDashboardStore.getState().setConfig(makeConfig([]))

    useDashboardStore
      .getState()
      .addWidget('p1', makeWidget('w1', { layout: { x: 50, y: 50, w: 80, h: 56, zOrder: 0 } }))

    const placed = useDashboardStore.getState().config?.pages[0]?.widgets[0]
    expect(placed).toBeDefined()
    // autoPlace lands at (0,0) on an empty 320×224 canvas
    expect(placed?.layout.x).toBe(0)
    expect(placed?.layout.y).toBe(0)
  })

  it('addWidget() is a no-op without a config', () => {
    useDashboardStore.getState().addWidget('p1', makeWidget('a'))
    expect(useDashboardStore.getState().config).toBeNull()
  })

  it('addWidget() is a no-op for an unknown page', () => {
    useDashboardStore.getState().setConfig(makeConfig([]))
    useDashboardStore.getState().addWidget('does_not_exist', makeWidget('a'))
    expect(useDashboardStore.getState().config?.pages[0]?.widgets).toHaveLength(0)
  })

  it('removeWidget() drops the entry and clears selection if it was the active one', () => {
    useDashboardStore.getState().setConfig(makeConfig([makeWidget('a'), makeWidget('b')]))
    useDashboardStore.getState().selectWidgets(['a', 'b'])

    useDashboardStore.getState().removeWidget('p1', 'a')

    const state = useDashboardStore.getState()
    expect(state.config?.pages[0]?.widgets.map((w) => w.id)).toEqual(['b'])
    expect(state.selectedWidgetIds).toEqual(['b'])
  })

  it('removeWidget() is a no-op without a config', () => {
    useDashboardStore.getState().removeWidget('p1', 'a')
    expect(useDashboardStore.getState().config).toBeNull()
  })

  it('removeWidget() is a no-op for an unknown page', () => {
    useDashboardStore.getState().setConfig(makeConfig([makeWidget('a')]))
    useDashboardStore.getState().removeWidget('nope', 'a')
    expect(useDashboardStore.getState().config?.pages[0]?.widgets).toHaveLength(1)
  })

  it('updateWidget() merges a patch and clamps the position when resizing', () => {
    useDashboardStore
      .getState()
      .setConfig(
        makeConfig([makeWidget('a', { layout: { x: 200, y: 100, w: 80, h: 56, zOrder: 0 } })])
      )

    useDashboardStore
      .getState()
      .updateWidget('p1', 'a', { layout: { x: 200, y: 100, w: 200, h: 56, zOrder: 0 } })

    const w = useDashboardStore.getState().config?.pages[0]?.widgets[0]
    // Width 200 from x=200 → would overflow the 320 canvas. Must clamp x to 120.
    expect(w?.layout.x).toBe(120)
  })

  it('updateWidget() is a no-op without a config', () => {
    useDashboardStore.getState().updateWidget('p1', 'a', { signal: 'rpm' })
    expect(useDashboardStore.getState().config).toBeNull()
  })

  it('updateWidget() is a no-op for an unknown page', () => {
    useDashboardStore.getState().setConfig(makeConfig([makeWidget('a')]))
    useDashboardStore.getState().updateWidget('nope', 'a', { signal: 'rpm' })
    expect(useDashboardStore.getState().config?.pages[0]?.widgets[0]?.signal).toBe('rpm')
  })

  it('updateWidget() is a no-op for an unknown widget id', () => {
    useDashboardStore.getState().setConfig(makeConfig([makeWidget('a')]))
    useDashboardStore.getState().updateWidget('p1', 'nope', { signal: 'iat' })
    expect(useDashboardStore.getState().config?.pages[0]?.widgets[0]?.signal).toBe('rpm')
  })

  it('moveWidget() updates layout without pushing to undo history', () => {
    useDashboardStore.getState().setConfig(makeConfig([makeWidget('a')]))
    expect(useDashboardStore.getState().past).toHaveLength(0)

    useDashboardStore.getState().moveWidget('p1', 'a', { x: 50, y: 60 })

    expect(useDashboardStore.getState().config?.pages[0]?.widgets[0]?.layout.x).toBe(50)
    expect(useDashboardStore.getState().past).toHaveLength(0)
  })

  it('moveWidget() is a no-op without a config', () => {
    useDashboardStore.getState().moveWidget('p1', 'a', { x: 5 })
    expect(useDashboardStore.getState().config).toBeNull()
  })

  it('commitWidgetMove() updates layout AND pushes a history snapshot', () => {
    useDashboardStore.getState().setConfig(makeConfig([makeWidget('a')]))
    expect(useDashboardStore.getState().past).toHaveLength(0)

    useDashboardStore.getState().commitWidgetMove('p1', 'a', { x: 100, y: 0 })

    expect(useDashboardStore.getState().config?.pages[0]?.widgets[0]?.layout.x).toBe(100)
    expect(useDashboardStore.getState().past).toHaveLength(1)
  })

  it('commitWidgetMove() is a no-op for an unknown widget', () => {
    useDashboardStore.getState().setConfig(makeConfig([makeWidget('a')]))
    useDashboardStore.getState().commitWidgetMove('p1', 'nope', { x: 50 })
    expect(useDashboardStore.getState().past).toHaveLength(0)
  })

  it('moveWidgets() applies multiple per-widget moves in one batch', () => {
    useDashboardStore.getState().setConfig(makeConfig([makeWidget('a'), makeWidget('b')]))

    useDashboardStore.getState().moveWidgets('p1', [
      { id: 'a', x: 0, y: 0 },
      { id: 'b', x: 160, y: 56 },
    ])

    const widgets = useDashboardStore.getState().config?.pages[0]?.widgets ?? []
    const a = widgets.find((w) => w.id === 'a')
    const b = widgets.find((w) => w.id === 'b')
    expect(a?.layout.y).toBe(0)
    expect(b?.layout.y).toBe(56)
  })

  it('moveWidgets() is a no-op without a config', () => {
    useDashboardStore.getState().moveWidgets('p1', [{ id: 'a', x: 0, y: 0 }])
    expect(useDashboardStore.getState().config).toBeNull()
  })

  it('resolveWidgetCollisions() pushes a history snapshot at drag-end', () => {
    useDashboardStore
      .getState()
      .setConfig(
        makeConfig([
          makeWidget('a', { layout: { x: 0, y: 0, w: 160, h: 56, zOrder: 0 } }),
          makeWidget('b', { layout: { x: 0, y: 56, w: 160, h: 56, zOrder: 0 } }),
        ])
      )
    expect(useDashboardStore.getState().past).toHaveLength(0)

    useDashboardStore.getState().resolveWidgetCollisions('p1', 'a')

    expect(useDashboardStore.getState().past).toHaveLength(1)
  })

  it('resolveWidgetCollisions() is a no-op for an unknown widget', () => {
    useDashboardStore.getState().setConfig(makeConfig([makeWidget('a')]))
    useDashboardStore.getState().resolveWidgetCollisions('p1', 'nope')
    expect(useDashboardStore.getState().past).toHaveLength(0)
  })

  it('commitDrag() pushes a history snapshot of the current config', () => {
    useDashboardStore.getState().setConfig(makeConfig([makeWidget('a')]))

    useDashboardStore.getState().commitDrag()

    expect(useDashboardStore.getState().past).toHaveLength(1)
    expect(useDashboardStore.getState().isDirty).toBe(true)
  })

  it('commitDrag() is a no-op without a config', () => {
    useDashboardStore.getState().commitDrag()
    expect(useDashboardStore.getState().past).toHaveLength(0)
  })

  it('alignWidgets(left) pins x to the leftmost widget', () => {
    useDashboardStore
      .getState()
      .setConfig(
        makeConfig([
          makeWidget('a', { layout: { x: 0, y: 0, w: 80, h: 56, zOrder: 0 } }),
          makeWidget('b', { layout: { x: 100, y: 0, w: 80, h: 56, zOrder: 0 } }),
        ])
      )

    useDashboardStore.getState().alignWidgets('p1', ['a', 'b'], 'left')

    const widgets = useDashboardStore.getState().config?.pages[0]?.widgets ?? []
    expect(widgets[0]?.layout.x).toBe(0)
    expect(widgets[1]?.layout.x).toBe(0)
  })

  it('alignWidgets(right) pins x so right edges line up', () => {
    useDashboardStore
      .getState()
      .setConfig(
        makeConfig([
          makeWidget('a', { layout: { x: 0, y: 0, w: 80, h: 56, zOrder: 0 } }),
          makeWidget('b', { layout: { x: 100, y: 0, w: 80, h: 56, zOrder: 0 } }),
        ])
      )

    useDashboardStore.getState().alignWidgets('p1', ['a', 'b'], 'right')

    const widgets = useDashboardStore.getState().config?.pages[0]?.widgets ?? []
    // right-most edge is x=180; both widgets w=80 → both x = 100
    expect(widgets[0]?.layout.x).toBe(100)
    expect(widgets[1]?.layout.x).toBe(100)
  })

  it('alignWidgets covers top / bottom / center-h / center-v branches', () => {
    useDashboardStore
      .getState()
      .setConfig(
        makeConfig([
          makeWidget('a', { layout: { x: 0, y: 0, w: 80, h: 40, zOrder: 0 } }),
          makeWidget('b', { layout: { x: 100, y: 60, w: 80, h: 40, zOrder: 0 } }),
        ])
      )

    useDashboardStore.getState().alignWidgets('p1', ['a', 'b'], 'top')
    expect(useDashboardStore.getState().config?.pages[0]?.widgets.map((w) => w.layout.y)).toEqual([
      0, 0,
    ])

    // Reset to a known shape to test 'bottom'
    useDashboardStore
      .getState()
      .setConfig(
        makeConfig([
          makeWidget('a', { layout: { x: 0, y: 0, w: 80, h: 40, zOrder: 0 } }),
          makeWidget('b', { layout: { x: 100, y: 60, w: 80, h: 40, zOrder: 0 } }),
        ])
      )
    useDashboardStore.getState().alignWidgets('p1', ['a', 'b'], 'bottom')
    expect(useDashboardStore.getState().config?.pages[0]?.widgets.map((w) => w.layout.y)).toEqual([
      60, 60,
    ])

    useDashboardStore
      .getState()
      .setConfig(
        makeConfig([
          makeWidget('a', { layout: { x: 0, y: 0, w: 80, h: 40, zOrder: 0 } }),
          makeWidget('b', { layout: { x: 100, y: 60, w: 80, h: 40, zOrder: 0 } }),
        ])
      )
    useDashboardStore.getState().alignWidgets('p1', ['a', 'b'], 'center-h')
    expect(useDashboardStore.getState().config?.pages[0]?.widgets.map((w) => w.layout.x)).toEqual([
      50, 50,
    ])

    useDashboardStore
      .getState()
      .setConfig(
        makeConfig([
          makeWidget('a', { layout: { x: 0, y: 0, w: 80, h: 40, zOrder: 0 } }),
          makeWidget('b', { layout: { x: 100, y: 60, w: 80, h: 40, zOrder: 0 } }),
        ])
      )
    useDashboardStore.getState().alignWidgets('p1', ['a', 'b'], 'center-v')
    expect(useDashboardStore.getState().config?.pages[0]?.widgets.map((w) => w.layout.y)).toEqual([
      30, 30,
    ])
  })

  it('alignWidgets() is a no-op when fewer than 2 targets are selected', () => {
    useDashboardStore.getState().setConfig(makeConfig([makeWidget('a')]))
    const before = useDashboardStore.getState().config

    useDashboardStore.getState().alignWidgets('p1', ['a'], 'left')

    expect(useDashboardStore.getState().config).toBe(before)
    expect(useDashboardStore.getState().past).toHaveLength(0)
  })

  it('alignWidgets() is a no-op without a config', () => {
    useDashboardStore.getState().alignWidgets('p1', ['a', 'b'], 'left')
    expect(useDashboardStore.getState().config).toBeNull()
  })

  it('alignWidgets() is a no-op for an unknown page', () => {
    useDashboardStore
      .getState()
      .setConfig(
        makeConfig([
          makeWidget('a', { layout: { x: 0, y: 0, w: 80, h: 40, zOrder: 0 } }),
          makeWidget('b', { layout: { x: 100, y: 60, w: 80, h: 40, zOrder: 0 } }),
        ])
      )

    useDashboardStore.getState().alignWidgets('nope', ['a', 'b'], 'left')

    expect(useDashboardStore.getState().past).toHaveLength(0)
  })

  it('distributeWidgets(h) spaces widgets evenly along x', () => {
    useDashboardStore
      .getState()
      .setConfig(
        makeConfig([
          makeWidget('a', { layout: { x: 0, y: 0, w: 40, h: 40, zOrder: 0 } }),
          makeWidget('b', { layout: { x: 50, y: 0, w: 40, h: 40, zOrder: 0 } }),
          makeWidget('c', { layout: { x: 200, y: 0, w: 40, h: 40, zOrder: 0 } }),
        ])
      )

    useDashboardStore.getState().distributeWidgets('p1', ['a', 'b', 'c'], 'h')

    const widgets = useDashboardStore.getState().config?.pages[0]?.widgets ?? []
    const xs = widgets.map((w) => w.layout.x).sort((a, b) => a - b)
    // a=0, c=200; gap = (240 - 120) / 2 = 60. b should be 0+40+60 = 100.
    expect(xs).toEqual([0, 100, 200])
  })

  it('distributeWidgets(v) spaces widgets evenly along y', () => {
    useDashboardStore
      .getState()
      .setConfig(
        makeConfig([
          makeWidget('a', { layout: { x: 0, y: 0, w: 40, h: 20, zOrder: 0 } }),
          makeWidget('b', { layout: { x: 0, y: 30, w: 40, h: 20, zOrder: 0 } }),
          makeWidget('c', { layout: { x: 0, y: 100, w: 40, h: 20, zOrder: 0 } }),
        ])
      )

    useDashboardStore.getState().distributeWidgets('p1', ['a', 'b', 'c'], 'v')

    const widgets = useDashboardStore.getState().config?.pages[0]?.widgets ?? []
    const ys = widgets.map((w) => w.layout.y).sort((a, b) => a - b)
    // a=0, c=100; total span = 120, total widget h = 60, gap = 60/2 = 30
    // b = 0+20+30 = 50
    expect(ys).toEqual([0, 50, 100])
  })

  it('distributeWidgets() is a no-op when fewer than 3 targets are selected', () => {
    useDashboardStore
      .getState()
      .setConfig(
        makeConfig([
          makeWidget('a', { layout: { x: 0, y: 0, w: 40, h: 40, zOrder: 0 } }),
          makeWidget('b', { layout: { x: 50, y: 0, w: 40, h: 40, zOrder: 0 } }),
        ])
      )

    useDashboardStore.getState().distributeWidgets('p1', ['a', 'b'], 'h')

    expect(useDashboardStore.getState().past).toHaveLength(0)
  })

  it('distributeWidgets() is a no-op without a config', () => {
    useDashboardStore.getState().distributeWidgets('p1', ['a', 'b', 'c'], 'h')
    expect(useDashboardStore.getState().config).toBeNull()
  })

  it('distributeWidgets() is a no-op for an unknown page', () => {
    useDashboardStore
      .getState()
      .setConfig(
        makeConfig([
          makeWidget('a', { layout: { x: 0, y: 0, w: 40, h: 40, zOrder: 0 } }),
          makeWidget('b', { layout: { x: 50, y: 0, w: 40, h: 40, zOrder: 0 } }),
          makeWidget('c', { layout: { x: 200, y: 0, w: 40, h: 40, zOrder: 0 } }),
        ])
      )

    useDashboardStore.getState().distributeWidgets('nope', ['a', 'b', 'c'], 'h')

    expect(useDashboardStore.getState().past).toHaveLength(0)
  })
})

describe('useDashboardStore.duplicateWidgets — edge cases', () => {
  beforeEach(resetStore)

  it('rolls the history push back when no clones could be placed', () => {
    // Fill the canvas so duplicating any widget has nowhere to land.
    const widgets: import('@tmbk/canshift-core').Widget[] = []
    // 320×240 canvas (showTopBar with height=16 → 224 usable). Pack many small.
    for (let row = 0; row < 5; row++) {
      for (let col = 0; col < 4; col++) {
        widgets.push(
          makeWidget(`w_${row.toString()}_${col.toString()}`, {
            layout: { x: col * 80, y: row * 44, w: 80, h: 44, zOrder: 0 },
          })
        )
      }
    }
    useDashboardStore.getState().setConfig(makeConfig(widgets))
    expect(useDashboardStore.getState().past).toHaveLength(0)

    useDashboardStore.getState().duplicateWidgets('p1', ['w_0_0'])

    // No room at all → push count must be 0 (rollback path).
    expect(useDashboardStore.getState().past).toHaveLength(0)
    expect(useDashboardStore.getState().config?.pages[0]?.widgets).toHaveLength(widgets.length)
  })

  it('falls back to autoPlace when both candidate slots overlap', () => {
    // Source at top-left; another widget below AND right of it
    useDashboardStore.getState().setConfig(
      makeConfig([
        makeWidget('a', { layout: { x: 0, y: 0, w: 160, h: 56, zOrder: 0 } }),
        makeWidget('block_below', {
          layout: { x: 0, y: 56, w: 160, h: 56, zOrder: 0 },
        }),
        makeWidget('block_right', {
          layout: { x: 160, y: 0, w: 160, h: 56, zOrder: 0 },
        }),
      ])
    )

    useDashboardStore.getState().duplicateWidgets('p1', ['a'])

    const widgets = useDashboardStore.getState().config?.pages[0]?.widgets ?? []
    expect(widgets).toHaveLength(4)
    // The clone landed somewhere from the autoPlace fallback; just confirm
    // it doesn't overlap the source.
    const clone = widgets[widgets.length - 1]
    expect(clone).toBeDefined()
    const layout = clone?.layout
    if (!layout) throw new Error('clone has no layout')
    expect(layout.y).not.toBe(0)
  })

  it('skips ids that do not exist on the page (no-op for unknown ids)', () => {
    useDashboardStore.getState().setConfig(makeConfig([makeWidget('a')]))

    useDashboardStore.getState().duplicateWidgets('p1', ['ghost'])

    expect(useDashboardStore.getState().config?.pages[0]?.widgets).toHaveLength(1)
    expect(useDashboardStore.getState().past).toHaveLength(0)
  })
})
