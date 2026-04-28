// dashboard.store.ts — Dashboard config state

import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import type { DashboardConfig } from '@tmbk/shared-core'

interface DashboardState {
  config: DashboardConfig | null
  filePath: string | null
  isDirty: boolean
  selectedPageId: string | null
  selectedWidgetId: string | null

  setConfig: (config: DashboardConfig, filePath?: string) => void
  updateConfig: (updater: (draft: DashboardConfig) => void) => void
  markSaved: (filePath: string) => void
  selectPage: (pageId: string | null) => void
  selectWidget: (widgetId: string | null) => void
}

export const useDashboardStore = create<DashboardState>()(
  immer((set) => ({
    config:            null,
    filePath:          null,
    isDirty:           false,
    selectedPageId:    null,
    selectedWidgetId:  null,

    setConfig: (config, filePath) => {
      set((s) => {
        s.config           = config
        s.filePath         = filePath ?? null
        s.isDirty          = false
        s.selectedPageId   = config.defaultPageId ?? null
        s.selectedWidgetId = null
      })
    },

    updateConfig: (updater) => {
      set((s) => {
        if (!s.config) return
        updater(s.config)
        s.isDirty = true
      })
    },

    markSaved: (filePath) => {
      set((s) => {
        s.filePath = filePath
        s.isDirty  = false
      })
    },

    selectPage: (pageId) => {
      set((s) => {
        s.selectedPageId   = pageId
        s.selectedWidgetId = null
      })
    },

    selectWidget: (widgetId) => {
      set((s) => { s.selectedWidgetId = widgetId })
    },
  }))
)
