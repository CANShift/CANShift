import { current } from 'immer'
import type { DashboardConfig, PageConfig, Widget } from '@tmbk/canshift-core'
import { resolveScreenProfile } from '@tmbk/canshift-core'
import type { IdentifiedPlacement } from '../../utils/layout'

export const HISTORY_LIMIT = 100

export const canvasDims = (config: DashboardConfig): { w: number; h: number } => {
  const profile = resolveScreenProfile(config.targetProfile)
  return { w: profile.width, h: profile.height }
}

export const widgetAreaHeight = (
  page: PageConfig,
  topBarHeight: number,
  canvasH: number
): number => (page.showTopBar !== false ? canvasH - topBarHeight : canvasH)

export const toPlacement = (w: Widget): IdentifiedPlacement => ({
  id: w.id,
  col: w.layout.col,
  colSpan: w.layout.colSpan,
  row: w.layout.row,
  rowSpan: w.layout.rowSpan,
})

export interface HistoryEntry {
  config: DashboardConfig
  label: string
}

interface HistoryHost {
  config: DashboardConfig | null
  past: HistoryEntry[]
  future: HistoryEntry[]
  isDirty: boolean
}

export const pushHistory = (s: HistoryHost, label: string): void => {
  if (!s.config) return
  s.past.push({ config: current(s.config), label })
  if (s.past.length > HISTORY_LIMIT) s.past.shift()
  s.future = []
}

export const widgetRef = (w: Pick<Widget, 'signal' | 'type'>): string =>
  w.signal ? w.signal : w.type

export const pageRef = (index: number): string => `page ${String(index + 1).padStart(2, '0')}`
