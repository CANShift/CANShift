import { current } from 'immer'
import type { Widget } from '@tmbk/canshift-core'
import { clampGridPlacement, placementsOverlap } from '@tmbk/canshift-core'
import { autoPlace } from '../../utils/layout'
import { pushHistory, toPlacement } from './helpers'
import type { ClipboardSlice, SliceCreator } from './types'

export const createClipboardSlice: SliceCreator<ClipboardSlice> = (set) => ({
  clipboardWidgets: [],

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

      pushHistory(s)

      const others = page.widgets.map(toPlacement)
      const newIds: string[] = []

      for (const src of s.clipboardWidgets) {
        const newId = `${src.type}_${crypto.randomUUID()}`
        const { col, colSpan, row, rowSpan } = src.layout
        const candidates = [
          { col: col + 1, row: row + 1 },
          { col, row: row + rowSpan },
          { col: col + colSpan, row },
        ]
        let pos: { col: number; row: number } | null = null
        for (const cand of candidates) {
          const placement = clampGridPlacement({ col: cand.col, colSpan, row: cand.row, rowSpan })
          if (!others.some((o) => placementsOverlap(placement, o))) {
            pos = { col: placement.col, row: placement.row }
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

  removeWidgets: (pageId, widgetIds) => {
    set((s) => {
      if (!s.config || widgetIds.length === 0) return
      const page = s.config.pages.find((p) => p.id === pageId)
      if (!page) return
      pushHistory(s)
      const idSet = new Set(widgetIds)
      page.widgets = page.widgets.filter((w) => !idSet.has(w.id))
      if (s.selectedWidgetId && idSet.has(s.selectedWidgetId)) s.selectedWidgetId = null
      s.selectedWidgetIds = s.selectedWidgetIds.filter((id) => !idSet.has(id))
      s.isDirty = true
    })
  },

  nudgeWidgets: (pageId, widgetIds, dCol, dRow) => {
    set((s) => {
      if (!s.config || widgetIds.length === 0) return
      const page = s.config.pages.find((p) => p.id === pageId)
      if (!page) return
      const targets = page.widgets.filter((w) => widgetIds.includes(w.id))
      if (targets.length === 0) return
      pushHistory(s)
      for (const w of targets) {
        const clamped = clampGridPlacement({
          ...w.layout,
          col: w.layout.col + dCol,
          row: w.layout.row + dRow,
        })
        w.layout.col = clamped.col
        w.layout.row = clamped.row
      }
      s.isDirty = true
    })
  },
})
