// dashboard.store.test.ts — unit coverage for the widget-mutation paths
// (duplicate, undo, isDirty propagation). The full store has many actions
// — this file focuses on the ones recently added or risky to regress.

import { beforeEach, describe, expect, it } from 'vitest'
import type { DashboardConfig, Widget } from '@tmbk/canshift-core'
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
