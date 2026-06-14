import { current } from 'immer'
import type { DashboardConfig, PageConfig, Widget } from '@tmbk/canshift-core'
import { resolveScreenProfile } from '@tmbk/canshift-core'

export const HISTORY_LIMIT = 50

export const canvasDims = (config: DashboardConfig): { w: number; h: number } => {
  const profile = resolveScreenProfile(config.targetProfile)
  return { w: profile.width, h: profile.height }
}

export const widgetAreaHeight = (
  page: PageConfig,
  topBarHeight: number,
  canvasH: number
): number => (page.showTopBar ? canvasH - topBarHeight : canvasH)

export const toLayoutRect = (
  w: Widget
): { id: string; x: number; y: number; w: number; h: number } => ({
  id: w.id,
  x: w.layout.x,
  y: w.layout.y,
  w: w.layout.w,
  h: w.layout.h,
})

interface HistoryHost {
  config: DashboardConfig | null
  past: DashboardConfig[]
  future: DashboardConfig[]
  isDirty: boolean
}

export const pushHistory = (s: HistoryHost): void => {
  if (!s.config) return
  s.past.push(current(s.config))
  if (s.past.length > HISTORY_LIMIT) s.past.shift()
  s.future = []
}
