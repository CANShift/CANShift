import type { StateCreator } from 'zustand'
import type {
  DashboardConfig,
  PageConfig,
  PageTemplate,
  ScreenProfileId,
  ThemePreset,
  TopBarConfig,
  Widget,
  WidgetLayout,
} from '@tmbk/canshift-core'

export type LoadFromDeviceOrDemoResult = 'device' | 'demo' | 'kept-edits'

export type AlignDirection = 'left' | 'right' | 'top' | 'bottom' | 'center-h' | 'center-v'

export interface LifecycleSlice {
  config: DashboardConfig | null
  isDirty: boolean

  setConfig: (config: DashboardConfig) => void
  setTargetProfile: (id: ScreenProfileId) => void
  loadFromDeviceOrDemo: (deviceConfig: DashboardConfig | null) => LoadFromDeviceOrDemoResult
  markPushed: () => void
  markDirty: () => void
}

export interface HistorySlice {
  past: DashboardConfig[]
  future: DashboardConfig[]
  undo: () => void
  redo: () => void
}

export interface PagesSlice {
  addPage: (page: PageConfig) => void
  duplicatePage: (pageId: string) => void
  removePage: (pageId: string) => void
  setDefaultPage: (pageId: string) => void
  updatePage: (pageId: string, patch: Partial<Omit<PageConfig, 'id' | 'widgets'>>) => void
  setPageTemplate: (pageId: string, template: PageTemplate) => void
  movePage: (fromIndex: number, toIndex: number) => void
  updateTopBar: (patch: Partial<TopBarConfig>) => void
}

export interface ThemeSlice {
  isPreviewDayMode: boolean
  togglePreviewTheme: () => void
  setDayTheme: (theme: ThemePreset | null) => void
  setNightTheme: (theme: ThemePreset | null) => void
}

export interface SelectionSlice {
  selectedPageId: string | null
  selectedWidgetId: string | null
  selectedWidgetIds: string[]
  selectPage: (pageId: string | null) => void
  selectWidget: (widgetId: string | null) => void
  selectWidgets: (widgetIds: string[]) => void
  toggleWidgetSelection: (widgetId: string) => void
}

export interface WidgetsSlice {
  addWidget: (pageId: string, widget: Widget) => void
  duplicateWidgets: (pageId: string, widgetIds: string[]) => void
  removeWidget: (pageId: string, widgetId: string) => void
  updateWidget: (pageId: string, widgetId: string, patch: Partial<Widget>) => void
  moveWidget: (pageId: string, widgetId: string, layout: Partial<WidgetLayout>) => void
  commitWidgetMove: (pageId: string, widgetId: string, layout: Partial<WidgetLayout>) => void
  moveWidgets: (pageId: string, moves: { id: string; x: number; y: number }[]) => void
  resolveWidgetCollisions: (pageId: string, widgetId: string) => void
  commitDrag: () => void
}

export interface LayoutOpsSlice {
  alignWidgets: (pageId: string, widgetIds: string[], direction: AlignDirection) => void
  distributeWidgets: (pageId: string, widgetIds: string[], axis: 'h' | 'v') => void
}

export interface ClipboardSlice {
  clipboardWidgets: Widget[]
  copyWidgets: (pageId: string, widgetIds: string[]) => void
  pasteWidgets: (pageId: string) => void
  removeWidgets: (pageId: string, widgetIds: string[]) => void
  nudgeWidgets: (pageId: string, widgetIds: string[], dx: number, dy: number) => void
}

export interface DashboardState
  extends LifecycleSlice,
    HistorySlice,
    PagesSlice,
    ThemeSlice,
    SelectionSlice,
    WidgetsSlice,
    LayoutOpsSlice,
    ClipboardSlice {}

export type SliceCreator<T> = StateCreator<
  DashboardState,
  [['zustand/immer', never]],
  [],
  T
>
