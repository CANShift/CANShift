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

export const useDashboardConfig = (): DashboardConfigBundle =>
  useDashboardStore(
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

export interface PreviewThemeBundle {
  isPreviewDayMode: boolean
  togglePreviewTheme: () => void
}

export const usePreviewTheme = (): PreviewThemeBundle =>
  useDashboardStore(
    useShallow((s) => ({
      isPreviewDayMode: s.isPreviewDayMode,
      togglePreviewTheme: s.togglePreviewTheme,
    }))
  )
