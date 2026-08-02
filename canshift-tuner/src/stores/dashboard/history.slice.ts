import { current } from 'immer'
import { HISTORY_LIMIT } from './helpers'
import type { HistorySlice, SliceCreator } from './types'

export const createHistorySlice: SliceCreator<HistorySlice> = (set) => ({
  past: [],
  future: [],

  undo: () => {
    set((s) => {
      if (s.past.length === 0 || !s.config) return
      const entry = s.past[s.past.length - 1]
      if (!entry) return
      s.past.splice(s.past.length - 1, 1)
      s.future.unshift({ config: current(s.config), label: entry.label })
      if (s.future.length > HISTORY_LIMIT) s.future.pop()
      s.config = entry.config
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
      const entry = s.future[0]
      if (!entry) return
      s.future.splice(0, 1)
      s.past.push({ config: current(s.config), label: entry.label })
      if (s.past.length > HISTORY_LIMIT) s.past.shift()
      s.config = entry.config
      s.isDirty = true
      s.selectedWidgetId = null
      s.selectedWidgetIds = []
      const pageStillExists = s.config.pages.some((p) => p.id === s.selectedPageId)
      if (!pageStillExists) s.selectedPageId = s.config.pages[0]?.id ?? null
    })
  },
})
