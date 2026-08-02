import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import { createClipboardSlice } from './dashboard/clipboard.slice'
import { createHistorySlice } from './dashboard/history.slice'
import { createLayoutOpsSlice } from './dashboard/layout-ops.slice'
import { createLifecycleSlice } from './dashboard/lifecycle.slice'
import { createPagesSlice } from './dashboard/pages.slice'
import { createSelectionSlice } from './dashboard/selection.slice'
import { createThemeSlice } from './dashboard/theme.slice'
import { createWidgetsSlice } from './dashboard/widgets.slice'
import { readAutosave, startAutosave } from './dashboard/autosave'
import type { DashboardState } from './dashboard/types'

export type { AlignDirection, DashboardState, LoadFromDeviceOrDemoResult } from './dashboard/types'

export const useDashboardStore = create<DashboardState>()(
  immer((...a) => ({
    ...createLifecycleSlice(...a),
    ...createHistorySlice(...a),
    ...createPagesSlice(...a),
    ...createThemeSlice(...a),
    ...createSelectionSlice(...a),
    ...createWidgetsSlice(...a),
    ...createLayoutOpsSlice(...a),
    ...createClipboardSlice(...a),
  }))
)

const restored = readAutosave()
if (restored) {
  useDashboardStore.setState({
    config: restored.config,
    isDirty: restored.isDirty,
    selectedPageId: restored.selectedPageId,
    selectedWidgetId: restored.selectedWidgetId,
    selectedWidgetIds: restored.selectedWidgetIds,
    lastSavedAt: restored.savedAt,
  })
}
startAutosave(useDashboardStore)
