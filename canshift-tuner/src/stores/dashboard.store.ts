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
import { DEFAULT_SIM_CONFIG } from '../config/default-sim-config'
import { DAY_THEME_PRESET } from '../constants/theme'

export type LoadFromDeviceOrDemoResult = 'device' | 'demo' | 'kept-edits'

const HISTORY_LIMIT = 50

export type AlignDirection = 'left' | 'right' | 'top' | 'bottom' | 'center-h' | 'center-v'

const canvasDims = (config: DashboardConfig): { w: number; h: number } => {
  const profile = resolveScreenProfile(config.targetProfile)
  return { w: profile.width, h: profile.height }
}

const widgetAreaHeight = (page: PageConfig, topBarHeight: number, canvasH: number): number =>
  page.showTopBar ? canvasH - topBarHeight : canvasH

const toLayoutRect = (w: Widget): { id: string; x: number; y: number; w: number; h: number } => ({
  id: w.id,
  x: w.layout.x,
  y: w.layout.y,
  w: w.layout.w,
  h: w.layout.h,
})

interface DashboardState {
  config: DashboardConfig | null
  filePath: string | null
  isDirty: boolean
  selectedPageId: string | null
  selectedWidgetId: string | null
  selectedWidgetIds: string[]

  clipboardWidgets: Widget[]

  past: DashboardConfig[]
  future: DashboardConfig[]

  isPreviewDayMode: boolean

  loadedFromDemoFallback: boolean

  pendingDeviceConfig: DashboardConfig | null

  setConfig: (config: DashboardConfig, filePath?: string) => void
  setEcuProfileKey: (key: string) => void
  setTargetProfile: (id: ScreenProfileId) => void
  loadImported: (config: DashboardConfig) => void
  loadFromDeviceOrDemo: (deviceConfig: DashboardConfig | null) => LoadFromDeviceOrDemoResult
  stagePendingDeviceConfig: (deviceConfig: DashboardConfig) => void
  acceptPendingDeviceConfig: () => void
  dismissPendingDeviceConfig: () => void
  clearDemoFallback: () => void
  markSaved: (filePath: string) => void
  markPushed: () => void

  undo: () => void
  redo: () => void

  selectPage: (pageId: string | null) => void
  addPage: (page: PageConfig) => void
  removePage: (pageId: string) => void
  setDefaultPage: (pageId: string) => void
  updatePage: (pageId: string, patch: Partial<Omit<PageConfig, 'id' | 'widgets'>>) => void
  setPageTemplate: (pageId: string, template: PageTemplate) => void
  movePage: (fromIndex: number, toIndex: number) => void
  updateTopBar: (patch: Partial<TopBarConfig>) => void

  togglePreviewTheme: () => void
  setDayTheme: (theme: ThemePreset | null) => void
  setNightTheme: (theme: ThemePreset | null) => void

  selectWidget: (widgetId: string | null) => void
  selectWidgets: (widgetIds: string[]) => void
  toggleWidgetSelection: (widgetId: string) => void
  addWidget: (pageId: string, widget: Widget) => void
  duplicateWidgets: (pageId: string, widgetIds: string[]) => void
  removeWidget: (pageId: string, widgetId: string) => void
  updateWidget: (pageId: string, widgetId: string, patch: Partial<Widget>) => void
  moveWidget: (pageId: string, widgetId: string, layout: Partial<WidgetLayout>) => void
  commitWidgetMove: (pageId: string, widgetId: string, layout: Partial<WidgetLayout>) => void
  moveWidgets: (pageId: string, moves: { id: string; x: number; y: number }[]) => void
  resolveWidgetCollisions: (pageId: string, widgetId: string) => void
  commitDrag: () => void
  alignWidgets: (pageId: string, widgetIds: string[], direction: AlignDirection) => void
  distributeWidgets: (pageId: string, widgetIds: string[], axis: 'h' | 'v') => void

  copyWidgets: (pageId: string, widgetIds: string[]) => void
  pasteWidgets: (pageId: string) => void
  removeWidgets: (pageId: string, widgetIds: string[]) => void
  nudgeWidgets: (pageId: string, widgetIds: string[], dx: number, dy: number) => void
}

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
        s.config.dayTheme ??= DAY_THEME_PRESET
        s.filePath = filePath ?? null
        s.isDirty = false
        s.selectedPageId = config.defaultPageId
        s.selectedWidgetId = null
        s.selectedWidgetIds = []
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
          s.loadedFromDemoFallback = false
          s.pendingDeviceConfig = null
          outcome = 'device'
          return
        }
        if (s.config === null) {
          s.past = []
          s.future = []
          s.config = structuredClone(DEFAULT_SIM_CONFIG)
          s.filePath = null
          s.isDirty = false
          s.selectedPageId = DEFAULT_SIM_CONFIG.defaultPageId
          s.selectedWidgetId = null
          s.selectedWidgetIds = []
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

    markPushed: () => {
      set((s) => {
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

        let pos: { x: number; y: number } | null = null
        const refWidget = s.selectedWidgetId
          ? page.widgets.find((w) => w.id === s.selectedWidgetId)
          : null

        if (refWidget) {
          const ref = toLayoutRect(refWidget)
          const gap = LAYOUT_GAP
          const adjacent = [
            { x: ref.x + ref.w + gap, y: ref.y },
            { x: ref.x, y: ref.y + ref.h + gap },
            { x: ref.x - nw - gap, y: ref.y },
            { x: ref.x, y: ref.y - nh - gap },
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
