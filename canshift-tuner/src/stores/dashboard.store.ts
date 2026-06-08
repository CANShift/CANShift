// dashboard.store.ts — Dashboard config state

import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import { current } from 'immer'
import type {
  DashboardConfig,
  PageConfig,
  PageTemplate,
  ScreenProfileId,
  ThemePreset,
  TopBarConfig,
  Widget,
  WidgetLayout,
} from '@tmbk/canshift-core'
import { resolveScreenProfile } from '@tmbk/canshift-core'
import { autoPlace, resolveCollisions, rectsOverlap, snapToGrid, LAYOUT_GAP } from '../utils/layout'
import { DEFAULT_SIM_CONFIG } from '../config/defaultSimConfig'
import { DAY_THEME_PRESET } from '../constants/theme'

/**
 * Outcome of {@link DashboardState.loadFromDeviceOrDemo} — lets callers log
 * what happened without re-implementing the decision they just delegated.
 */
export type LoadFromDeviceOrDemoResult = 'device' | 'demo' | 'kept-edits'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const HISTORY_LIMIT = 50

export type AlignDirection = 'left' | 'right' | 'top' | 'bottom' | 'center-h' | 'center-v'

// Canvas dimensions are driven by the dashboard's `targetProfile` (issue #548).
// `undefined` falls back to the default profile (`crowpanel-28`, 320×240) via
// `resolveScreenProfile`, so legacy configs keep their previous canvas bounds.
function canvasDims(config: DashboardConfig): { w: number; h: number } {
  const profile = resolveScreenProfile(config.targetProfile)
  return { w: profile.width, h: profile.height }
}

function widgetAreaHeight(
  page: PageConfig,
  topBarHeight: number,
  canvasH: number
): number {
  return page.showTopBar ? canvasH - topBarHeight : canvasH
}

function toLayoutRect(w: Widget): { id: string; x: number; y: number; w: number; h: number } {
  return { id: w.id, x: w.layout.x, y: w.layout.y, w: w.layout.w, h: w.layout.h }
}

// ---------------------------------------------------------------------------
// Store types
// ---------------------------------------------------------------------------

interface DashboardState {
  config: DashboardConfig | null
  filePath: string | null
  isDirty: boolean
  selectedPageId: string | null
  selectedWidgetId: string | null
  /** All currently selected widget ids (superset of selectedWidgetId). */
  selectedWidgetIds: string[]

  /** Widgets held in the in-app clipboard (Cmd+C / Cmd+X). */
  clipboardWidgets: Widget[]

  /** Undo history — configs before the last N mutations. */
  past: DashboardConfig[]
  /** Redo stack — configs after the last undo. */
  future: DashboardConfig[]

  /**
   * Studio-only preview flag — true = render canvas using config.dayTheme
   * (or the built-in day defaults if dayTheme isn't set yet).
   * Does NOT mutate the config; does NOT go through history.
   */
  isPreviewDayMode: boolean

  /**
   * Set when {@link DashboardState.loadFromDeviceOrDemo} seeds the demo
   * because the device had no config and the editor was empty (issue #418).
   * Drives the post-recovery banner: if a later device probe returns a real
   * config, we ask the user before clobbering their preview-only demo.
   * Cleared as soon as the user explicitly picks a real config (device,
   * imported, opened from disk) or dismisses the prompt.
   */
  loadedFromDemoFallback: boolean

  /**
   * Device config returned by a probe AFTER {@link loadedFromDemoFallback}
   * was set — held aside so the user can decide between swapping in or
   * keeping the demo (issue #418). `null` when nothing is pending.
   */
  pendingDeviceConfig: DashboardConfig | null

  // Config lifecycle
  setConfig: (config: DashboardConfig, filePath?: string) => void
  /** Stamp the active ECU profile key into the current config so it survives a device push/read cycle. */
  setEcuProfileKey: (key: string) => void
  /**
   * Pick the target screen profile this dashboard is authored for (issue #548).
   * Drives the canvas dimensions in the editor preview and travels with the
   * config through every push-config / save cycle. Goes through undo history
   * so the user can revert a misclick like any other dashboard edit.
   */
  setTargetProfile: (id: ScreenProfileId) => void
  /**
   * Replace the current config from an imported source (Import menu, shared
   * dashboard) — clears `filePath`, marks dirty so the user is prompted to
   * Save As, resets history. The next Save will land in a new file.
   */
  loadImported: (config: DashboardConfig) => void
  /**
   * Atomically pick between the device's config, the demo fallback, and
   * keeping the user's current in-progress edits — reads the latest store
   * state inside the setter so concurrent edits aren't clobbered (#216).
   *
   * Decision (latest state, never a stale closure):
   * - `deviceConfig` provided → device wins, replace editor state.
   * - `deviceConfig === null` and editor is empty → load DEFAULT_SIM_CONFIG.
   * - `deviceConfig === null` and editor has a config → keep edits, no-op.
   */
  loadFromDeviceOrDemo: (deviceConfig: DashboardConfig | null) => LoadFromDeviceOrDemoResult
  /**
   * Stage a real device config behind the demo fallback prompt — used by
   * the device-config-load hook when the editor is currently showing the
   * auto-loaded demo (issue #418). Caller must check {@link loadedFromDemoFallback}
   * before invoking; otherwise prefer {@link loadFromDeviceOrDemo} directly.
   */
  stagePendingDeviceConfig: (deviceConfig: DashboardConfig) => void
  /** User accepts the staged device config — replaces the demo, clears flags. */
  acceptPendingDeviceConfig: () => void
  /** User keeps the demo — discards the staged device config and clears the prompt. */
  dismissPendingDeviceConfig: () => void
  /** User dismisses the initial "no config on device — showing default" banner. */
  clearDemoFallback: () => void
  markSaved: (filePath: string) => void

  // Edit history
  undo: () => void
  redo: () => void

  // Page operations
  selectPage: (pageId: string | null) => void
  addPage: (page: PageConfig) => void
  removePage: (pageId: string) => void
  setDefaultPage: (pageId: string) => void
  updatePage: (pageId: string, patch: Partial<Omit<PageConfig, 'id' | 'widgets'>>) => void
  /**
   * Set the page rendering template (#451). Passing `custom` clears the field
   * so default configs stay byte-stable when re-saved; any other value writes
   * the template literal as-is.
   */
  setPageTemplate: (pageId: string, template: PageTemplate) => void
  movePage: (fromIndex: number, toIndex: number) => void
  updateTopBar: (patch: Partial<TopBarConfig>) => void

  // Theme
  /** Toggle the studio day/night preview without touching the config. */
  togglePreviewTheme: () => void
  /** Save (or clear) the day theme in the config. Goes through undo history. */
  setDayTheme: (theme: ThemePreset | null) => void
  /**
   * Save (or clear) the night theme in the config. Mirror of {@link setDayTheme}
   * — goes through undo history, marks dirty. Issue #21 v2.
   */
  setNightTheme: (theme: ThemePreset | null) => void

  // Widget operations
  selectWidget: (widgetId: string | null) => void
  /** Set the full multi-selection (replaces current selection). */
  selectWidgets: (widgetIds: string[]) => void
  /** Toggle a single widget in/out of the current multi-selection (Shift+click). */
  toggleWidgetSelection: (widgetId: string) => void
  /** Add a widget; auto-places it in the first free spot. */
  addWidget: (pageId: string, widget: Widget) => void
  /**
   * Clone the given widgets within a page (Cmd+D). Each clone gets a fresh id
   * and is auto-placed near the source widget. New clones become the selection.
   */
  duplicateWidgets: (pageId: string, widgetIds: string[]) => void
  removeWidget: (pageId: string, widgetId: string) => void
  updateWidget: (pageId: string, widgetId: string, patch: Partial<Widget>) => void
  /**
   * Preview a widget move during drag — updates position but does NOT push to undo
   * history. Call this on every mousemove event for smooth tracking.
   */
  moveWidget: (pageId: string, widgetId: string, layout: Partial<WidgetLayout>) => void
  /**
   * Commit a widget move on drag-end — updates position AND pushes to undo history.
   * Call this on mouseup after a single-widget drag instead of resolveWidgetCollisions
   * when you want to skip collision cascading.
   */
  commitWidgetMove: (pageId: string, widgetId: string, layout: Partial<WidgetLayout>) => void
  /** Move multiple widgets simultaneously during a multi-drag — no history. */
  moveWidgets: (pageId: string, moves: { id: string; x: number; y: number }[]) => void
  /** Called on drag-end: resolves collisions and cascades pushed widgets. */
  resolveWidgetCollisions: (pageId: string, widgetId: string) => void
  /** Called on multi-widget drag-end: commits positions to history (no collision resolution). */
  commitDrag: () => void
  /** Align selected widgets along the given axis. */
  alignWidgets: (pageId: string, widgetIds: string[], direction: AlignDirection) => void
  /** Distribute selected widgets evenly along the given axis. */
  distributeWidgets: (pageId: string, widgetIds: string[], axis: 'h' | 'v') => void

  /** Copy widgets into the clipboard — no history push. */
  copyWidgets: (pageId: string, widgetIds: string[]) => void
  /** Paste clipboard contents onto the page, auto-placed, with history. */
  pasteWidgets: (pageId: string) => void
  /** Remove multiple widgets in a single history step. */
  removeWidgets: (pageId: string, widgetIds: string[]) => void
  /** Move widgets by (dx, dy) firmware-pixels — clamps to canvas, pushes to history. */
  nudgeWidgets: (pageId: string, widgetIds: string[], dx: number, dy: number) => void
}

// ---------------------------------------------------------------------------
// Store implementation
// ---------------------------------------------------------------------------

export const useDashboardStore = create<DashboardState>()(
  immer((set) => ({
    config: null,
    filePath: null,
    isDirty: false,
    selectedPageId: null,
    selectedWidgetId: null,
    selectedWidgetIds: [],
    clipboardWidgets: [],
    past: [],
    future: [],
    isPreviewDayMode: false,
    loadedFromDemoFallback: false,
    pendingDeviceConfig: null,

    setConfig: (config, filePath) => {
      set((s) => {
        s.past = []
        s.future = []
        s.config = config
        // Day theme is always active — backfill if absent in older configs.
        s.config.dayTheme ??= DAY_THEME_PRESET
        s.filePath = filePath ?? null
        s.isDirty = false
        s.selectedPageId = config.defaultPageId
        s.selectedWidgetId = null
        s.selectedWidgetIds = []
        // User picked a real config — clear any auto-demo bookkeeping.
        s.loadedFromDemoFallback = false
        s.pendingDeviceConfig = null
      })
    },

    setEcuProfileKey: (key) => {
      set((s) => {
        if (s.config) {
          s.config.ecuProfileKey = key
          s.isDirty = true
        }
      })
    },

    setTargetProfile: (id) => {
      set((s) => {
        if (!s.config) return
        // No-op when the value isn't actually changing — keeps the undo
        // stack uncluttered when the user re-selects the current profile.
        if (s.config.targetProfile === id) return
        s.past.push(current(s.config))
        if (s.past.length > HISTORY_LIMIT) s.past.shift()
        s.future = []
        s.config.targetProfile = id
        s.isDirty = true
      })
    },

    loadImported: (config) => {
      set((s) => {
        s.past = []
        s.future = []
        s.config = config
        s.filePath = null
        s.isDirty = true
        s.selectedPageId = config.defaultPageId
        s.selectedWidgetId = null
        s.selectedWidgetIds = []
        s.loadedFromDemoFallback = false
        s.pendingDeviceConfig = null
      })
    },

    loadFromDeviceOrDemo: (deviceConfig) => {
      let outcome: LoadFromDeviceOrDemoResult = 'kept-edits'
      set((s) => {
        if (deviceConfig) {
          s.past = []
          s.future = []
          s.config = deviceConfig
          s.filePath = null
          s.isDirty = false
          s.selectedPageId = deviceConfig.defaultPageId
          s.selectedWidgetId = null
          s.selectedWidgetIds = []
          // Real device config landed — drop the demo-fallback bookkeeping.
          s.loadedFromDemoFallback = false
          s.pendingDeviceConfig = null
          outcome = 'device'
          return
        }
        if (s.config === null) {
          s.past = []
          s.future = []
          // Clone so Immer drafting can't mutate the module-level constant —
          // mirrors App.tsx:80 and prevents leaked edits between successive
          // demo-fallback loads (#1287).
          s.config = structuredClone(DEFAULT_SIM_CONFIG)
          s.filePath = null
          s.isDirty = false
          s.selectedPageId = DEFAULT_SIM_CONFIG.defaultPageId
          s.selectedWidgetId = null
          s.selectedWidgetIds = []
          // Tag the editor so we know to prompt before clobbering this demo
          // if the device's SD comes back online with a real config (#418).
          s.loadedFromDemoFallback = true
          s.pendingDeviceConfig = null
          outcome = 'demo'
          return
        }
        outcome = 'kept-edits'
      })
      return outcome
    },

    stagePendingDeviceConfig: (deviceConfig) => {
      set((s) => {
        s.pendingDeviceConfig = deviceConfig
      })
    },

    acceptPendingDeviceConfig: () => {
      set((s) => {
        const pending = s.pendingDeviceConfig
        if (!pending) return
        s.past = []
        s.future = []
        s.config = pending
        s.filePath = null
        s.isDirty = false
        s.selectedPageId = pending.defaultPageId
        s.selectedWidgetId = null
        s.selectedWidgetIds = []
        s.loadedFromDemoFallback = false
        s.pendingDeviceConfig = null
      })
    },

    dismissPendingDeviceConfig: () => {
      set((s) => {
        s.pendingDeviceConfig = null
        // Keep loadedFromDemoFallback true — the editor still shows the demo,
        // and any FUTURE device probe with a real config should still prompt.
      })
    },

    clearDemoFallback: () => {
      set((s) => {
        s.loadedFromDemoFallback = false
      })
    },

    markSaved: (filePath) => {
      set((s) => {
        s.filePath = filePath
        s.isDirty = false
      })
    },

    undo: () => {
      set((s) => {
        if (s.past.length === 0 || !s.config) return
        const prev = s.past[s.past.length - 1]
        if (!prev) return
        s.past.splice(s.past.length - 1, 1)
        s.future.unshift(current(s.config))
        if (s.future.length > HISTORY_LIMIT) s.future.pop()
        s.config = prev
        s.isDirty = true
        s.selectedWidgetId = null
        s.selectedWidgetIds = []
        const pageStillExists = s.config.pages.some((p) => p.id === s.selectedPageId)
        if (!pageStillExists) s.selectedPageId = s.config.pages[0]?.id ?? null
      })
    },

    redo: () => {
      set((s) => {
        if (s.future.length === 0 || !s.config) return
        const next = s.future[0]
        if (!next) return
        s.future.splice(0, 1)
        s.past.push(current(s.config))
        if (s.past.length > HISTORY_LIMIT) s.past.shift()
        s.config = next
        s.isDirty = true
        s.selectedWidgetId = null
        s.selectedWidgetIds = []
        const pageStillExists = s.config.pages.some((p) => p.id === s.selectedPageId)
        if (!pageStillExists) s.selectedPageId = s.config.pages[0]?.id ?? null
      })
    },

    selectPage: (pageId) => {
      set((s) => {
        s.selectedPageId = pageId
        s.selectedWidgetId = null
        s.selectedWidgetIds = []
      })
    },

    addPage: (page) => {
      set((s) => {
        if (!s.config) return
        s.past.push(current(s.config))
        if (s.past.length > HISTORY_LIMIT) s.past.shift()
        s.future = []
        s.config.pages.push(page)
        s.selectedPageId = page.id
        s.isDirty = true
      })
    },

    removePage: (pageId) => {
      set((s) => {
        if (!s.config) return
        s.past.push(current(s.config))
        if (s.past.length > HISTORY_LIMIT) s.past.shift()
        s.future = []
        s.config.pages = s.config.pages.filter((p) => p.id !== pageId)
        if (s.selectedPageId === pageId) {
          s.selectedPageId = s.config.pages[0]?.id ?? null
        }
        s.isDirty = true
      })
    },

    setDefaultPage: (pageId) => {
      set((s) => {
        if (!s.config) return
        s.past.push(current(s.config))
        if (s.past.length > HISTORY_LIMIT) s.past.shift()
        s.future = []
        s.config.defaultPageId = pageId
        s.isDirty = true
      })
    },

    updatePage: (pageId, patch) => {
      set((s) => {
        if (!s.config) return
        s.past.push(current(s.config))
        if (s.past.length > HISTORY_LIMIT) s.past.shift()
        s.future = []
        const idx = s.config.pages.findIndex((p) => p.id === pageId)
        if (idx === -1) return
        const existing = s.config.pages[idx]
        if (!existing) return
        s.config.pages[idx] = { ...existing, ...patch }
        s.isDirty = true
      })
    },

    setPageTemplate: (pageId, template) => {
      set((s) => {
        if (!s.config) return
        s.past.push(current(s.config))
        if (s.past.length > HISTORY_LIMIT) s.past.shift()
        s.future = []
        const idx = s.config.pages.findIndex((p) => p.id === pageId)
        if (idx === -1) return
        const existing = s.config.pages[idx]
        if (!existing) return
        if (template === 'custom') {
          // `custom` is the implicit default — drop the field so existing
          // configs re-serialize byte-for-byte.
          const { template: _drop, ...rest } = existing
          s.config.pages[idx] = rest
        } else {
          s.config.pages[idx] = { ...existing, template }
        }
        s.isDirty = true
      })
    },

    togglePreviewTheme: () => {
      set((s) => {
        s.isPreviewDayMode = !s.isPreviewDayMode
      })
    },

    setDayTheme: (theme) => {
      set((s) => {
        if (!s.config) return
        s.past.push(current(s.config))
        if (s.past.length > HISTORY_LIMIT) s.past.shift()
        s.future = []
        if (theme === null) {
          delete s.config.dayTheme
        } else {
          s.config.dayTheme = theme
        }
        s.isDirty = true
      })
    },

    setNightTheme: (theme) => {
      set((s) => {
        if (!s.config) return
        s.past.push(current(s.config))
        if (s.past.length > HISTORY_LIMIT) s.past.shift()
        s.future = []
        if (theme === null) {
          delete s.config.nightTheme
        } else {
          s.config.nightTheme = theme
        }
        s.isDirty = true
      })
    },

    movePage: (fromIndex, toIndex) => {
      set((s) => {
        if (!s.config) return
        s.past.push(current(s.config))
        if (s.past.length > HISTORY_LIMIT) s.past.shift()
        s.future = []
        const pages = s.config.pages
        if (fromIndex < 0 || fromIndex >= pages.length) return
        if (toIndex < 0 || toIndex >= pages.length) return
        const [moved] = pages.splice(fromIndex, 1)
        if (moved) pages.splice(toIndex, 0, moved)
        s.isDirty = true
      })
    },

    updateTopBar: (patch) => {
      set((s) => {
        if (!s.config) return
        s.past.push(current(s.config))
        if (s.past.length > HISTORY_LIMIT) s.past.shift()
        s.future = []
        s.config.topBar = { ...s.config.topBar, ...patch }
        s.isDirty = true
      })
    },

    selectWidget: (widgetId) => {
      set((s) => {
        s.selectedWidgetId = widgetId
        s.selectedWidgetIds = widgetId ? [widgetId] : []
      })
    },

    selectWidgets: (widgetIds) => {
      set((s) => {
        s.selectedWidgetIds = widgetIds
        s.selectedWidgetId = widgetIds[widgetIds.length - 1] ?? null
      })
    },

    toggleWidgetSelection: (widgetId) => {
      set((s) => {
        const idx = s.selectedWidgetIds.indexOf(widgetId)
        if (idx === -1) {
          s.selectedWidgetIds.push(widgetId)
          s.selectedWidgetId = widgetId
        } else {
          s.selectedWidgetIds.splice(idx, 1)
          s.selectedWidgetId = s.selectedWidgetIds[s.selectedWidgetIds.length - 1] ?? null
        }
      })
    },

    addWidget: (pageId, widget) => {
      set((s) => {
        if (!s.config) return
        const page = s.config.pages.find((p) => p.id === pageId)
        if (!page) return

        s.past.push(current(s.config))
        if (s.past.length > HISTORY_LIMIT) s.past.shift()
        s.future = []

        const { w: canvasW, h: canvasFullH } = canvasDims(s.config)
        const canvasH = widgetAreaHeight(page, s.config.topBar.height, canvasFullH)
        const others = page.widgets.map(toLayoutRect)
        const nw = widget.layout.w
        const nh = widget.layout.h

        // Try to place adjacent to the currently selected widget (right, below, left, above)
        let pos: { x: number; y: number } | null = null
        const refWidget = s.selectedWidgetId
          ? page.widgets.find((w) => w.id === s.selectedWidgetId)
          : null

        if (refWidget) {
          const ref = toLayoutRect(refWidget)
          const gap = LAYOUT_GAP
          const adjacent = [
            { x: ref.x + ref.w + gap, y: ref.y }, // right
            { x: ref.x, y: ref.y + ref.h + gap }, // below
            { x: ref.x - nw - gap, y: ref.y }, // left
            { x: ref.x, y: ref.y - nh - gap }, // above
          ]
          for (const cand of adjacent) {
            const sx = snapToGrid(cand.x)
            const sy = snapToGrid(cand.y)
            if (sx < 0 || sy < 0 || sx + nw > canvasW || sy + nh > canvasH) continue
            const rect = { id: '__new__', x: sx, y: sy, w: nw, h: nh }
            if (!others.some((o) => rectsOverlap(rect, o))) {
              pos = { x: sx, y: sy }
              break
            }
          }
        }

        // Fallback: scan for first free position
        pos ??= autoPlace({ w: nw, h: nh }, others, canvasW, canvasH)

        if (pos) {
          widget.layout.x = pos.x
          widget.layout.y = pos.y
        }

        page.widgets.push(widget)
        s.selectedWidgetId = widget.id
        s.selectedWidgetIds = [widget.id]
        s.isDirty = true
      })
    },

    duplicateWidgets: (pageId, widgetIds) => {
      set((s) => {
        if (!s.config || widgetIds.length === 0) return
        const page = s.config.pages.find((p) => p.id === pageId)
        if (!page) return

        const sources = widgetIds
          .map((id) => page.widgets.find((w) => w.id === id))
          .filter((w): w is Widget => w !== undefined)
        if (sources.length === 0) return

        s.past.push(current(s.config))
        if (s.past.length > HISTORY_LIMIT) s.past.shift()
        s.future = []

        const { w: canvasW, h: canvasFullH } = canvasDims(s.config)
        const canvasH = widgetAreaHeight(page, s.config.topBar.height, canvasFullH)
        const others = page.widgets.map(toLayoutRect)
        const newIds: string[] = []

        for (const src of sources) {
          const newId = `${src.type}_${crypto.randomUUID()}`
          // Try to land just below the source first; fall back to the right,
          // then to the first free slot anywhere on the page.
          const candidates = [
            { x: src.layout.x, y: src.layout.y + src.layout.h + LAYOUT_GAP },
            { x: src.layout.x + src.layout.w + LAYOUT_GAP, y: src.layout.y },
          ]
          let pos: { x: number; y: number } | null = null
          for (const cand of candidates) {
            const sx = snapToGrid(cand.x)
            const sy = snapToGrid(cand.y)
            if (sx < 0 || sy < 0) continue
            if (sx + src.layout.w > canvasW || sy + src.layout.h > canvasH) continue
            const rect = { id: '__new__', x: sx, y: sy, w: src.layout.w, h: src.layout.h }
            if (!others.some((o) => rectsOverlap(rect, o))) {
              pos = { x: sx, y: sy }
              break
            }
          }
          pos ??= autoPlace({ w: src.layout.w, h: src.layout.h }, others, canvasW, canvasH)
          if (!pos) continue

          const clone: Widget = {
            ...src,
            id: newId,
            layout: { ...src.layout, x: pos.x, y: pos.y },
            style: { ...src.style },
            config: { ...src.config },
          }
          page.widgets.push(clone)
          others.push(toLayoutRect(clone))
          newIds.push(newId)
        }

        if (newIds.length > 0) {
          s.selectedWidgetId = newIds[newIds.length - 1] ?? null
          s.selectedWidgetIds = newIds
          s.isDirty = true
        } else {
          // No room anywhere — roll back the history push so undo isn't a no-op.
          s.past.pop()
        }
      })
    },

    removeWidget: (pageId, widgetId) => {
      set((s) => {
        if (!s.config) return
        const page = s.config.pages.find((p) => p.id === pageId)
        if (!page) return
        s.past.push(current(s.config))
        if (s.past.length > HISTORY_LIMIT) s.past.shift()
        s.future = []
        page.widgets = page.widgets.filter((w) => w.id !== widgetId)
        if (s.selectedWidgetId === widgetId) s.selectedWidgetId = null
        s.selectedWidgetIds = s.selectedWidgetIds.filter((id) => id !== widgetId)
        s.isDirty = true
      })
    },

    updateWidget: (pageId, widgetId, patch) => {
      set((s) => {
        if (!s.config) return
        const page = s.config.pages.find((p) => p.id === pageId)
        if (!page) return
        const widgetIdx = page.widgets.findIndex((w) => w.id === widgetId)
        if (widgetIdx === -1) return
        s.past.push(current(s.config))
        if (s.past.length > HISTORY_LIMIT) s.past.shift()
        s.future = []
        const existing = page.widgets[widgetIdx]
        if (!existing) return
        const merged = { ...existing, ...patch }
        // Clamp position so the widget never overflows the canvas after resize.
        const { w: canvasW, h: canvasFullH } = canvasDims(s.config)
        const canvasH = widgetAreaHeight(page, s.config.topBar.height, canvasFullH)
        merged.layout = {
          ...merged.layout,
          x: Math.max(0, Math.min(merged.layout.x, canvasW - merged.layout.w)),
          y: Math.max(0, Math.min(merged.layout.y, canvasH - merged.layout.h)),
        }
        page.widgets[widgetIdx] = merged
        s.isDirty = true
      })
    },

    // previewWidgetMove — called at 60fps during drag; does NOT push to undo history.
    moveWidget: (pageId, widgetId, layout) => {
      set((s) => {
        if (!s.config) return
        const page = s.config.pages.find((p) => p.id === pageId)
        if (!page) return
        const widgetIdx = page.widgets.findIndex((w) => w.id === widgetId)
        if (widgetIdx === -1) return
        const w = page.widgets[widgetIdx]
        if (!w) return
        page.widgets[widgetIdx] = { ...w, layout: { ...w.layout, ...layout } }
        s.isDirty = true
      })
    },

    // commitWidgetMove — called on mouseup for a single-widget drag; pushes to history.
    commitWidgetMove: (pageId, widgetId, layout) => {
      set((s) => {
        if (!s.config) return
        const page = s.config.pages.find((p) => p.id === pageId)
        if (!page) return
        const widgetIdx = page.widgets.findIndex((w) => w.id === widgetId)
        if (widgetIdx === -1) return
        s.past.push(current(s.config))
        if (s.past.length > HISTORY_LIMIT) s.past.shift()
        s.future = []
        const w = page.widgets[widgetIdx]
        if (!w) return
        page.widgets[widgetIdx] = { ...w, layout: { ...w.layout, ...layout } }
        s.isDirty = true
      })
    },

    // moveWidgets is NOT added to history — called 60fps during multi-drag
    moveWidgets: (pageId, moves) => {
      set((s) => {
        if (!s.config) return
        const page = s.config.pages.find((p) => p.id === pageId)
        if (!page) return
        for (const move of moves) {
          const widget = page.widgets.find((w) => w.id === move.id)
          if (widget) {
            widget.layout.x = move.x
            widget.layout.y = move.y
          }
        }
        s.isDirty = true
      })
    },

    resolveWidgetCollisions: (pageId, widgetId) => {
      set((s) => {
        if (!s.config) return
        const page = s.config.pages.find((p) => p.id === pageId)
        if (!page) return
        const widget = page.widgets.find((w) => w.id === widgetId)
        if (!widget) return

        // Snapshot taken here (drag-end) — not during the drag itself
        s.past.push(current(s.config))
        if (s.past.length > HISTORY_LIMIT) s.past.shift()
        s.future = []

        const { w: canvasW, h: canvasFullH } = canvasDims(s.config)
        const canvasH = widgetAreaHeight(page, s.config.topBar.height, canvasFullH)
        const others = page.widgets.filter((w) => w.id !== widgetId).map(toLayoutRect)
        const moved = toLayoutRect(widget)

        const changes = resolveCollisions(
          moved,
          widget.layout.x,
          widget.layout.y,
          others,
          canvasW,
          canvasH
        )

        for (const w of page.widgets) {
          const np = changes.get(w.id)
          if (np) {
            w.layout.x = np.x
            w.layout.y = np.y
          }
        }

        // Verify the dropped widget no longer overlaps anything after cascade.
        // If it does (crowded canvas / clamp edge case), relocate it via autoPlace.
        const finalOthers = page.widgets.filter((w) => w.id !== widgetId).map(toLayoutRect)
        const finalRect = toLayoutRect(page.widgets.find((w) => w.id === widgetId) ?? widget)
        const stillOverlaps = finalOthers.some((o) => rectsOverlap(finalRect, o))
        if (stillOverlaps) {
          const fallback = autoPlace(
            { w: widget.layout.w, h: widget.layout.h },
            finalOthers,
            canvasW,
            canvasH
          )
          if (fallback) {
            widget.layout.x = fallback.x
            widget.layout.y = fallback.y
          }
        }

        s.isDirty = true
      })
    },

    // Called on multi-widget drag-end: commits current positions to history without
    // collision resolution (widgets may overlap — user chose these positions).
    commitDrag: () => {
      set((s) => {
        if (!s.config) return
        s.past.push(current(s.config))
        if (s.past.length > HISTORY_LIMIT) s.past.shift()
        s.future = []
        s.isDirty = true
      })
    },

    alignWidgets: (pageId, widgetIds, direction) => {
      set((s) => {
        if (!s.config) return
        const page = s.config.pages.find((p) => p.id === pageId)
        if (!page) return
        const targets = page.widgets.filter((w) => widgetIds.includes(w.id))
        if (targets.length < 2) return

        s.past.push(current(s.config))
        if (s.past.length > HISTORY_LIMIT) s.past.shift()
        s.future = []

        const minX = Math.min(...targets.map((w) => w.layout.x))
        const maxX = Math.max(...targets.map((w) => w.layout.x + w.layout.w))
        const minY = Math.min(...targets.map((w) => w.layout.y))
        const maxY = Math.max(...targets.map((w) => w.layout.y + w.layout.h))

        for (const w of targets) {
          switch (direction) {
            case 'left':
              w.layout.x = minX
              break
            case 'right':
              w.layout.x = maxX - w.layout.w
              break
            case 'top':
              w.layout.y = minY
              break
            case 'bottom':
              w.layout.y = maxY - w.layout.h
              break
            case 'center-h':
              w.layout.x = Math.round((minX + maxX) / 2 - w.layout.w / 2)
              break
            case 'center-v':
              w.layout.y = Math.round((minY + maxY) / 2 - w.layout.h / 2)
              break
          }
        }
        s.isDirty = true
      })
    },

    distributeWidgets: (pageId, widgetIds, axis) => {
      set((s) => {
        if (!s.config) return
        const page = s.config.pages.find((p) => p.id === pageId)
        if (!page) return
        const targets = page.widgets.filter((w) => widgetIds.includes(w.id))
        if (targets.length < 3) return

        s.past.push(current(s.config))
        if (s.past.length > HISTORY_LIMIT) s.past.shift()
        s.future = []

        if (axis === 'h') {
          const sorted = [...targets].sort((a, b) => a.layout.x - b.layout.x)
          const first = sorted[0]
          const last = sorted[sorted.length - 1]
          if (!first || !last) return
          const totalSpan = last.layout.x + last.layout.w - first.layout.x
          const totalWidgetW = sorted.reduce((sum, w) => sum + w.layout.w, 0)
          const gap = (totalSpan - totalWidgetW) / (sorted.length - 1)
          let curX = first.layout.x
          for (const w of sorted) {
            w.layout.x = Math.round(curX)
            curX += w.layout.w + gap
          }
        } else {
          const sorted = [...targets].sort((a, b) => a.layout.y - b.layout.y)
          const first = sorted[0]
          const last = sorted[sorted.length - 1]
          if (!first || !last) return
          const totalSpan = last.layout.y + last.layout.h - first.layout.y
          const totalWidgetH = sorted.reduce((sum, w) => sum + w.layout.h, 0)
          const gap = (totalSpan - totalWidgetH) / (sorted.length - 1)
          let curY = first.layout.y
          for (const w of sorted) {
            w.layout.y = Math.round(curY)
            curY += w.layout.h + gap
          }
        }
        s.isDirty = true
      })
    },

    copyWidgets: (pageId, widgetIds) => {
      set((s) => {
        if (!s.config || widgetIds.length === 0) return
        const page = s.config.pages.find((p) => p.id === pageId)
        if (!page) return
        const plain = current(page.widgets)
        s.clipboardWidgets = plain.filter((w) => widgetIds.includes(w.id))
      })
    },

    pasteWidgets: (pageId) => {
      set((s) => {
        if (!s.config || s.clipboardWidgets.length === 0) return
        const page = s.config.pages.find((p) => p.id === pageId)
        if (!page) return

        s.past.push(current(s.config))
        if (s.past.length > HISTORY_LIMIT) s.past.shift()
        s.future = []

        const { w: canvasW, h: canvasFullH } = canvasDims(s.config)
        const canvasH = widgetAreaHeight(page, s.config.topBar.height, canvasFullH)
        const others = page.widgets.map(toLayoutRect)
        const newIds: string[] = []

        for (const src of s.clipboardWidgets) {
          const newId = `${src.type}_${crypto.randomUUID()}`
          const candidates = [
            { x: src.layout.x + 16, y: src.layout.y + 16 },
            { x: src.layout.x, y: src.layout.y + src.layout.h + LAYOUT_GAP },
            { x: src.layout.x + src.layout.w + LAYOUT_GAP, y: src.layout.y },
          ]
          let pos: { x: number; y: number } | null = null
          for (const cand of candidates) {
            const sx = Math.round(cand.x)
            const sy = Math.round(cand.y)
            if (sx < 0 || sy < 0 || sx + src.layout.w > canvasW || sy + src.layout.h > canvasH)
              continue
            const rect = { id: '__new__', x: sx, y: sy, w: src.layout.w, h: src.layout.h }
            if (!others.some((o) => rectsOverlap(rect, o))) {
              pos = { x: sx, y: sy }
              break
            }
          }
          pos ??= autoPlace({ w: src.layout.w, h: src.layout.h }, others, canvasW, canvasH)
          if (!pos) continue

          const clone: Widget = {
            ...src,
            id: newId,
            layout: { ...src.layout, x: pos.x, y: pos.y },
            style: { ...src.style },
            config: { ...src.config },
          }
          page.widgets.push(clone)
          others.push(toLayoutRect(clone))
          newIds.push(newId)
        }

        if (newIds.length > 0) {
          s.selectedWidgetId = newIds[newIds.length - 1] ?? null
          s.selectedWidgetIds = newIds
          s.isDirty = true
        } else {
          s.past.pop()
        }
      })
    },

    removeWidgets: (pageId, widgetIds) => {
      set((s) => {
        if (!s.config || widgetIds.length === 0) return
        const page = s.config.pages.find((p) => p.id === pageId)
        if (!page) return
        s.past.push(current(s.config))
        if (s.past.length > HISTORY_LIMIT) s.past.shift()
        s.future = []
        const idSet = new Set(widgetIds)
        page.widgets = page.widgets.filter((w) => !idSet.has(w.id))
        if (s.selectedWidgetId && idSet.has(s.selectedWidgetId)) s.selectedWidgetId = null
        s.selectedWidgetIds = s.selectedWidgetIds.filter((id) => !idSet.has(id))
        s.isDirty = true
      })
    },

    nudgeWidgets: (pageId, widgetIds, dx, dy) => {
      set((s) => {
        if (!s.config || widgetIds.length === 0) return
        const page = s.config.pages.find((p) => p.id === pageId)
        if (!page) return
        const targets = page.widgets.filter((w) => widgetIds.includes(w.id))
        if (targets.length === 0) return
        s.past.push(current(s.config))
        if (s.past.length > HISTORY_LIMIT) s.past.shift()
        s.future = []
        const { w: canvasW, h: canvasFullH } = canvasDims(s.config)
        const canvasH = widgetAreaHeight(page, s.config.topBar.height, canvasFullH)
        for (const w of targets) {
          w.layout.x = Math.max(0, Math.min(w.layout.x + dx, canvasW - w.layout.w))
          w.layout.y = Math.max(0, Math.min(w.layout.y + dy, canvasH - w.layout.h))
        }
        s.isDirty = true
      })
    },
  }))
)
