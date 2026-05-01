// dashboard.store.ts — Dashboard config state

import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import { current } from 'immer'
import type {
  DashboardConfig,
  PageConfig,
  PagePalette,
  TopBarConfig,
  Widget,
  WidgetLayout,
} from '@tmbk/canshift-core'
import { autoPlace, resolveCollisions, rectsOverlap, snapToGrid, LAYOUT_GAP } from '../utils/layout'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const HISTORY_LIMIT = 50

export type AlignDirection = 'left' | 'right' | 'top' | 'bottom' | 'center-h' | 'center-v'

function widgetAreaHeight(page: PageConfig, topBarHeight: number): number {
  return page.showTopBar ? 240 - topBarHeight : 240
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

  /** Undo history — configs before the last N mutations. */
  past: DashboardConfig[]
  /** Redo stack — configs after the last undo. */
  future: DashboardConfig[]

  // Config lifecycle
  setConfig: (config: DashboardConfig, filePath?: string) => void
  markSaved: (filePath: string) => void

  // Edit history
  undo: () => void
  redo: () => void

  // Page operations
  selectPage: (pageId: string | null) => void
  addPage: (page: PageConfig) => void
  removePage: (pageId: string) => void
  renamePage: (pageId: string, name: string) => void
  setDefaultPage: (pageId: string) => void
  updatePage: (pageId: string, patch: Partial<Omit<PageConfig, 'id' | 'widgets'>>) => void
  movePage: (fromIndex: number, toIndex: number) => void
  updateTopBar: (patch: Partial<TopBarConfig>) => void

  // Widget operations
  selectWidget: (widgetId: string | null) => void
  /** Set the full multi-selection (replaces current selection). */
  selectWidgets: (widgetIds: string[]) => void
  /** Toggle a single widget in/out of the current multi-selection (Shift+click). */
  toggleWidgetSelection: (widgetId: string) => void
  /** Add a widget; auto-places it in the first free spot. */
  addWidget: (pageId: string, widget: Widget) => void
  removeWidget: (pageId: string, widgetId: string) => void
  updateWidget: (pageId: string, widgetId: string, patch: Partial<Widget>) => void
  /** Move during drag — does NOT resolve collisions (for smooth tracking). */
  moveWidget: (pageId: string, widgetId: string, layout: Partial<WidgetLayout>) => void
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
  /** Apply backgroundColor + palette to every page in the dashboard at once. */
  applyTheme: (bgColor: string, palette: PagePalette) => void
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
    past: [],
    future: [],

    setConfig: (config, filePath) => {
      set((s) => {
        s.past = []
        s.future = []
        s.config = config
        s.filePath = filePath ?? null
        s.isDirty = false
        s.selectedPageId = config.defaultPageId
        s.selectedWidgetId = null
        s.selectedWidgetIds = []
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

    renamePage: (pageId, name) => {
      set((s) => {
        if (!s.config) return
        s.past.push(current(s.config))
        if (s.past.length > HISTORY_LIMIT) s.past.shift()
        s.future = []
        const page = s.config.pages.find((p) => p.id === pageId)
        if (!page) return
        page.name = name
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
        const page = s.config.pages.find((p) => p.id === pageId)
        if (!page) return
        Object.assign(page, patch)
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
        Object.assign(s.config.topBar, patch)
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

        const canvasH = widgetAreaHeight(page, s.config.topBar.height)
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
            if (sx < 0 || sy < 0 || sx + nw > 320 || sy + nh > canvasH) continue
            const rect = { id: '__new__', x: sx, y: sy, w: nw, h: nh }
            if (!others.some((o) => rectsOverlap(rect, o))) {
              pos = { x: sx, y: sy }
              break
            }
          }
        }

        // Fallback: scan for first free position
        pos ??= autoPlace({ w: nw, h: nh }, others, 320, canvasH)

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
        const widget = page.widgets.find((w) => w.id === widgetId)
        if (!widget) return
        s.past.push(current(s.config))
        if (s.past.length > HISTORY_LIMIT) s.past.shift()
        s.future = []
        Object.assign(widget, patch)
        // Clamp position so the widget never overflows the canvas after resize.
        const canvasH = widgetAreaHeight(page, s.config.topBar.height)
        widget.layout.x = Math.max(0, Math.min(widget.layout.x, 320 - widget.layout.w))
        widget.layout.y = Math.max(0, Math.min(widget.layout.y, canvasH - widget.layout.h))
        s.isDirty = true
      })
    },

    // moveWidget is NOT added to history — called 60fps during drag
    moveWidget: (pageId, widgetId, layout) => {
      set((s) => {
        if (!s.config) return
        const page = s.config.pages.find((p) => p.id === pageId)
        if (!page) return
        const widget = page.widgets.find((w) => w.id === widgetId)
        if (!widget) return
        Object.assign(widget.layout, layout)
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

        const canvasH = widgetAreaHeight(page, s.config.topBar.height)
        const others = page.widgets.filter((w) => w.id !== widgetId).map(toLayoutRect)
        const moved = toLayoutRect(widget)

        const changes = resolveCollisions(
          moved,
          widget.layout.x,
          widget.layout.y,
          others,
          320,
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
            320,
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

    applyTheme: (bgColor, palette) => {
      set((s) => {
        if (!s.config) return
        s.past.push(current(s.config))
        if (s.past.length > HISTORY_LIMIT) s.past.shift()
        s.future = []
        for (const page of s.config.pages) {
          page.backgroundColor = bgColor as `#${string}`
          page.palette = { ...palette }
        }
        s.isDirty = true
      })
    },
  }))
)
