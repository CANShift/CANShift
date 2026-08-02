import { current } from 'immer'
import { HISTORY_LIMIT } from './helpers'
import type { HistorySlice, SliceCreator } from './types'

const fixupSelection = (s: {
  config: { pages: { id: string }[] } | null
  selectedPageId: string | null
  selectedWidgetId: string | null
  selectedWidgetIds: string[]
}): void => {
  if (!s.config) return
  s.selectedWidgetId = null
  s.selectedWidgetIds = []
  const pageStillExists = s.config.pages.some((p) => p.id === s.selectedPageId)
  if (!pageStillExists) s.selectedPageId = s.config.pages[0]?.id ?? null
}

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
      fixupSelection(s)
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
      fixupSelection(s)
    })
  },

  jumpTo: (target) => {
    set((s) => {
      if (!s.config) return
      if (target.kind === 'past') {
        if (target.index < 0 || target.index >= s.past.length) return
        while (s.past.length > target.index) {
          const entry = s.past[s.past.length - 1]
          if (!entry) break
          s.past.splice(s.past.length - 1, 1)
          s.future.unshift({ config: current(s.config), label: entry.label })
          s.config = entry.config
        }
        if (s.future.length > HISTORY_LIMIT) s.future.length = HISTORY_LIMIT
      } else {
        if (target.index < 0 || target.index >= s.future.length) return
        for (let k = 0; k <= target.index; k++) {
          const entry = s.future[0]
          if (!entry) break
          s.future.splice(0, 1)
          s.past.push({ config: current(s.config), label: entry.label })
          s.config = entry.config
        }
        while (s.past.length > HISTORY_LIMIT) s.past.shift()
      }
      s.isDirty = true
      fixupSelection(s)
    })
  },
})
