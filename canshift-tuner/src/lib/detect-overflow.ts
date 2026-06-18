import type { DashboardConfig, Widget } from '@tmbk/canshift-core'
import { resolveScreenProfile } from '@tmbk/canshift-core'

export interface OverflowingWidget {
  pageId: string
  widgetId: string
  type: Widget['type']
  layout: Widget['layout']
}

export const detectOverflow = (config: DashboardConfig): OverflowingWidget[] => {
  const profile = resolveScreenProfile(config.targetProfile)
  const out: OverflowingWidget[] = []
  for (const page of config.pages) {
    for (const widget of page.widgets) {
      const { x, y, w, h } = widget.layout
      if (x < 0 || y < 0 || x + w > profile.width || y + h > profile.height) {
        out.push({ pageId: page.id, widgetId: widget.id, type: widget.type, layout: widget.layout })
      }
    }
  }
  return out
}
