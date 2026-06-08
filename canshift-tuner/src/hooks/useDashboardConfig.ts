// hooks/useDashboardConfig.ts — Shallow-stable bundles of the
// dashboard-store slices the editor panels read in lockstep.
//
// Replaces the repeated `const x = useDashboardStore((s) => s.x)`
// boilerplate in `PropertyPanel` and `ScreenSettingsPanel` (audit
// follow-up to #1207). `useShallow` keeps the bundle from re-rendering
// the panel when an unrelated dashboard-store key changes.

import { useShallow } from 'zustand/react/shallow'
import type { DashboardConfig, PageConfig, ScreenProfileId, Widget } from '@tmbk/canshift-core'
import { useDashboardStore } from '../stores/dashboard.store'

export interface DashboardConfigBundle {
  config: DashboardConfig | null
  selectedWidgetId: string | null
  updateWidget: (pageId: string, widgetId: string, patch: Partial<Widget>) => void
  removeWidget: (pageId: string, widgetId: string) => void
  addPage: (page: PageConfig) => void
  removePage: (pageId: string) => void
  setTargetProfile: (profileId: ScreenProfileId) => void
}

/**
 * Bundle of the dashboard-store slices the `PropertyPanel` reads
 * together. Selecting them in one `useShallow` call replaces seven
 * individual selectors and stops the panel re-rendering on unrelated
 * store updates.
 */
export function useDashboardConfig(): DashboardConfigBundle {
  return useDashboardStore(
    useShallow((s) => ({
      config: s.config,
      selectedWidgetId: s.selectedWidgetId,
      updateWidget: s.updateWidget,
      removeWidget: s.removeWidget,
      addPage: s.addPage,
      removePage: s.removePage,
      setTargetProfile: s.setTargetProfile,
    }))
  )
}

export interface PreviewThemeBundle {
  isPreviewDayMode: boolean
  togglePreviewTheme: () => void
}

/**
 * Smaller bundle for the screen-settings preview-theme toggle. Kept
 * separate from `useDashboardConfig` so callers that only need the
 * theme toggle don't subscribe to every editor-config slice.
 */
export function usePreviewTheme(): PreviewThemeBundle {
  return useDashboardStore(
    useShallow((s) => ({
      isPreviewDayMode: s.isPreviewDayMode,
      togglePreviewTheme: s.togglePreviewTheme,
    }))
  )
}
