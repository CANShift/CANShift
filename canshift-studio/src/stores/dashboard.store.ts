// dashboard.store.ts — Dashboard config state

import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import type { DashboardConfig, PageConfig, Widget, WidgetLayout } from '@tmbk/canshift-core'
import { autoPlace, resolveCollisions } from '../utils/layout'

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

        // Auto-place: find first free spot, default to (0,0) if canvas is full
        const pos = autoPlace({ w: widget.layout.w, h: widget.layout.h }, others, 320, canvasH)
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

        s.isDirty = true
      })
    },
  }))
)
