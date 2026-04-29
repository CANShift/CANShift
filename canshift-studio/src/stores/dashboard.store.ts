// dashboard.store.ts — Dashboard config state

import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import type {
  DashboardConfig,
  PageConfig,
  TopBarConfig,
  Widget,
  WidgetLayout,
} from '@tmbk/canshift-core'
import { autoPlace, resolveCollisions, rectsOverlap, snapToGrid, LAYOUT_GAP } from '../utils/layout'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

  // Config lifecycle
  setConfig: (config: DashboardConfig, filePath?: string) => void
  markSaved: (filePath: string) => void

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
  /** Add a widget; auto-places it in the first free spot. */
  addWidget: (pageId: string, widget: Widget) => void
  removeWidget: (pageId: string, widgetId: string) => void
  updateWidget: (pageId: string, widgetId: string, patch: Partial<Widget>) => void
  /** Move during drag — does NOT resolve collisions (for smooth tracking). */
  moveWidget: (pageId: string, widgetId: string, layout: Partial<WidgetLayout>) => void
  /** Called on drag-end: resolves collisions and cascades pushed widgets. */
  resolveWidgetCollisions: (pageId: string, widgetId: string) => void
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

    setConfig: (config, filePath) => {
      set((s) => {
        s.config = config
        s.filePath = filePath ?? null
        s.isDirty = false
        s.selectedPageId = config.defaultPageId
        s.selectedWidgetId = null
      })
    },

    markSaved: (filePath) => {
      set((s) => {
        s.filePath = filePath
        s.isDirty = false
      })
    },

    selectPage: (pageId) => {
      set((s) => {
        s.selectedPageId = pageId
        s.selectedWidgetId = null
      })
    },

    addPage: (page) => {
      set((s) => {
        if (!s.config) return
        s.config.pages.push(page)
        s.selectedPageId = page.id
        s.isDirty = true
      })
    },

    removePage: (pageId) => {
      set((s) => {
        if (!s.config) return
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
        const page = s.config.pages.find((p) => p.id === pageId)
        if (!page) return
        page.name = name
        s.isDirty = true
      })
    },

    setDefaultPage: (pageId) => {
      set((s) => {
        if (!s.config) return
        s.config.defaultPageId = pageId
        s.isDirty = true
      })
    },

    updatePage: (pageId, patch) => {
      set((s) => {
        if (!s.config) return
        const page = s.config.pages.find((p) => p.id === pageId)
        if (!page) return
        Object.assign(page, patch)
        s.isDirty = true
      })
    },

    movePage: (fromIndex, toIndex) => {
      set((s) => {
        if (!s.config) return
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
        Object.assign(s.config.topBar, patch)
        s.isDirty = true
      })
    },

    selectWidget: (widgetId) => {
      set((s) => {
        s.selectedWidgetId = widgetId
      })
    },

    addWidget: (pageId, widget) => {
      set((s) => {
        if (!s.config) return
        const page = s.config.pages.find((p) => p.id === pageId)
        if (!page) return

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
        s.isDirty = true
      })
    },

    removeWidget: (pageId, widgetId) => {
      set((s) => {
        if (!s.config) return
        const page = s.config.pages.find((p) => p.id === pageId)
        if (!page) return
        page.widgets = page.widgets.filter((w) => w.id !== widgetId)
        if (s.selectedWidgetId === widgetId) s.selectedWidgetId = null
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
        Object.assign(widget, patch)
        // Clamp position so the widget never overflows the canvas after resize.
        const canvasH = widgetAreaHeight(page, s.config.topBar.height)
        widget.layout.x = Math.max(0, Math.min(widget.layout.x, 320 - widget.layout.w))
        widget.layout.y = Math.max(0, Math.min(widget.layout.y, canvasH - widget.layout.h))
        s.isDirty = true
      })
    },

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

    resolveWidgetCollisions: (pageId, widgetId) => {
      set((s) => {
        if (!s.config) return
        const page = s.config.pages.find((p) => p.id === pageId)
        if (!page) return
        const widget = page.widgets.find((w) => w.id === widgetId)
        if (!widget) return

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
  }))
)
