import { current } from 'immer'
import type { Widget } from '@tmbk/canshift-core'
import { autoPlace, LAYOUT_GAP, rectsOverlap } from '../../utils/layout'
import { canvasDims, pushHistory, toLayoutRect, widgetAreaHeight } from './helpers'
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
      pushHistory(s)
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
      pushHistory(s)
      const { w: canvasW, h: canvasFullH } = canvasDims(s.config)
      const canvasH = widgetAreaHeight(page, s.config.topBar.height, canvasFullH)
      for (const w of targets) {
        w.layout.x = Math.max(0, Math.min(w.layout.x + dx, canvasW - w.layout.w))
        w.layout.y = Math.max(0, Math.min(w.layout.y + dy, canvasH - w.layout.h))
      }
      s.isDirty = true
    })
  },
})
