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

      pushHistory(s)

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
})
