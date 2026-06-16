import type { SelectionSlice, SliceCreator } from './types'

export const createSelectionSlice: SliceCreator<SelectionSlice> = (set) => ({
  selectedPageId: null,
  selectedWidgetId: null,
  selectedWidgetIds: [],

  selectPage: (pageId) => {
    set((s) => {
      s.selectedPageId = pageId
      s.selectedWidgetId = null
      s.selectedWidgetIds = []
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
})
