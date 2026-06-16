import { current } from 'immer'
import { HISTORY_LIMIT } from './helpers'
import type { HistorySlice, SliceCreator } from './types'

export const createHistorySlice: SliceCreator<HistorySlice> = (set) => ({
  past: [],
  future: [],

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
})
