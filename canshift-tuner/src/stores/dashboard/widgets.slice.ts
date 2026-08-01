import type { Widget } from '@tmbk/canshift-core'
import { clampGridPlacement, isSpanOverflowing, placementsOverlap } from '@tmbk/canshift-core'
import { autoPlace, resolveCollisions } from '../../utils/layout'
import { pushHistory, toPlacement } from './helpers'
import type { SliceCreator, WidgetsSlice } from './types'

export const createWidgetsSlice: SliceCreator<WidgetsSlice> = (set) => ({
  addWidget: (pageId, widget) => {
    set((s) => {
      if (!s.config) return
      const page = s.config.pages.find((p) => p.id === pageId)
      if (!page) return

      pushHistory(s)

      const others = page.widgets.map(toPlacement)
      const colSpan = widget.layout.colSpan
      const rowSpan = widget.layout.rowSpan

      let pos: { col: number; row: number } | null = null
      const refWidget = s.selectedWidgetId
        ? page.widgets.find((w) => w.id === s.selectedWidgetId)
        : null

      if (refWidget) {
        const ref = refWidget.layout
        const adjacent = [
          { col: ref.col + ref.colSpan, row: ref.row },
          { col: ref.col, row: ref.row + ref.rowSpan },
          { col: ref.col - colSpan, row: ref.row },
          { col: ref.col, row: ref.row - rowSpan },
        ]
        for (const cand of adjacent) {
          const placement = { col: cand.col, colSpan, row: cand.row, rowSpan }
          if (isSpanOverflowing(placement)) continue
          if (!others.some((o) => placementsOverlap(placement, o))) {
            pos = { col: cand.col, row: cand.row }
            break
          }
        }
      }

      pos ??= autoPlace({ colSpan, rowSpan }, others)

      if (pos) {
        widget.layout.col = pos.col
        widget.layout.row = pos.row
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

      const others = page.widgets.map(toPlacement)
      const newIds: string[] = []

      for (const src of sources) {
        const newId = `${src.type}_${crypto.randomUUID()}`
        const { col, colSpan, row, rowSpan } = src.layout
        const candidates = [
          { col, row: row + rowSpan },
          { col: col + colSpan, row },
        ]
        let pos: { col: number; row: number } | null = null
        for (const cand of candidates) {
          const placement = { col: cand.col, colSpan, row: cand.row, rowSpan }
          if (isSpanOverflowing(placement)) continue
          if (!others.some((o) => placementsOverlap(placement, o))) {
            pos = { col: cand.col, row: cand.row }
            break
          }
        }
        pos ??= autoPlace({ colSpan, rowSpan }, others)
        if (!pos) continue

        const clone: Widget = {
          ...src,
          id: newId,
          layout: { ...src.layout, col: pos.col, row: pos.row },
          style: { ...src.style },
          config: { ...src.config },
        }
        page.widgets.push(clone)
        others.push(toPlacement(clone))
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
      merged.layout = { ...clampGridPlacement(merged.layout), zOrder: merged.layout.zOrder }
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
          widget.layout.col = move.col
          widget.layout.row = move.row
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

      const others = page.widgets.filter((w) => w.id !== widgetId).map(toPlacement)
      const moved = toPlacement(widget)

      const changes = resolveCollisions(moved, others)

      for (const w of page.widgets) {
        const np = changes.get(w.id)
        if (np) {
          w.layout.col = np.col
          w.layout.row = np.row
        }
      }

      const finalOthers = page.widgets.filter((w) => w.id !== widgetId).map(toPlacement)
      const finalPlacement = toPlacement(page.widgets.find((w) => w.id === widgetId) ?? widget)
      const stillOverlaps = finalOthers.some((o) => placementsOverlap(finalPlacement, o))
      if (stillOverlaps) {
        const fallback = autoPlace(
          { colSpan: widget.layout.colSpan, rowSpan: widget.layout.rowSpan },
          finalOthers
        )
        if (fallback) {
          widget.layout.col = fallback.col
          widget.layout.row = fallback.row
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
