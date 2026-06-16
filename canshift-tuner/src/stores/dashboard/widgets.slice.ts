import type { Widget } from '@tmbk/canshift-core'
import { autoPlace, LAYOUT_GAP, rectsOverlap, resolveCollisions, snapToGrid } from '../../utils/layout'
import { canvasDims, pushHistory, toLayoutRect, widgetAreaHeight } from './helpers'
import type { SliceCreator, WidgetsSlice } from './types'

export const createWidgetsSlice: SliceCreator<WidgetsSlice> = (set) => ({
  addWidget: (pageId, widget) => {
    set((s) => {
      if (!s.config) return
      const page = s.config.pages.find((p) => p.id === pageId)
      if (!page) return

      pushHistory(s)

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

      pushHistory(s)

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
      pushHistory(s)
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
      pushHistory(s)
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
      pushHistory(s)
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

      pushHistory(s)

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
      pushHistory(s)
      s.isDirty = true
    })
  },
})
