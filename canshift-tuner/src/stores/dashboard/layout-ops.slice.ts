import { clampGridPlacement } from '@tmbk/canshift-core'
import { pushHistory } from './helpers'
import type { LayoutOpsSlice, SliceCreator } from './types'

export const createLayoutOpsSlice: SliceCreator<LayoutOpsSlice> = (set) => ({
  alignWidgets: (pageId, widgetIds, direction) => {
    set((s) => {
      if (!s.config) return
      const page = s.config.pages.find((p) => p.id === pageId)
      if (!page) return
      const targets = page.widgets.filter((w) => widgetIds.includes(w.id))
      if (targets.length < 2) return

      pushHistory(s)

      const minCol = Math.min(...targets.map((w) => w.layout.col))
      const maxCol = Math.max(...targets.map((w) => w.layout.col + w.layout.colSpan))
      const minRow = Math.min(...targets.map((w) => w.layout.row))
      const maxRow = Math.max(...targets.map((w) => w.layout.row + w.layout.rowSpan))

      for (const w of targets) {
        const placement = { ...w.layout }
        switch (direction) {
          case 'left':
            placement.col = minCol
            break
          case 'right':
            placement.col = maxCol - w.layout.colSpan
            break
          case 'top':
            placement.row = minRow
            break
          case 'bottom':
            placement.row = maxRow - w.layout.rowSpan
            break
          case 'center-h':
            placement.col = Math.round((minCol + maxCol) / 2 - w.layout.colSpan / 2)
            break
          case 'center-v':
            placement.row = Math.round((minRow + maxRow) / 2 - w.layout.rowSpan / 2)
            break
        }
        const clamped = clampGridPlacement(placement)
        w.layout.col = clamped.col
        w.layout.row = clamped.row
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

      pushHistory(s)

      if (axis === 'h') {
        const sorted = [...targets].sort((a, b) => a.layout.col - b.layout.col)
        const first = sorted[0]
        const last = sorted[sorted.length - 1]
        if (!first || !last) return
        const totalSpan = last.layout.col + last.layout.colSpan - first.layout.col
        const totalWidgetCols = sorted.reduce((sum, w) => sum + w.layout.colSpan, 0)
        const gap = (totalSpan - totalWidgetCols) / (sorted.length - 1)
        let curCol = first.layout.col
        for (const w of sorted) {
          w.layout.col = clampGridPlacement({ ...w.layout, col: Math.round(curCol) }).col
          curCol += w.layout.colSpan + gap
        }
      } else {
        const sorted = [...targets].sort((a, b) => a.layout.row - b.layout.row)
        const first = sorted[0]
        const last = sorted[sorted.length - 1]
        if (!first || !last) return
        const totalSpan = last.layout.row + last.layout.rowSpan - first.layout.row
        const totalWidgetRows = sorted.reduce((sum, w) => sum + w.layout.rowSpan, 0)
        const gap = (totalSpan - totalWidgetRows) / (sorted.length - 1)
        let curRow = first.layout.row
        for (const w of sorted) {
          w.layout.row = clampGridPlacement({ ...w.layout, row: Math.round(curRow) }).row
          curRow += w.layout.rowSpan + gap
        }
      }
      s.isDirty = true
    })
  },
})
