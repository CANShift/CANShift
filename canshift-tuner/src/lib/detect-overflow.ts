import type { DashboardConfig, Widget } from '@tmbk/canshift-core'
import { isSpanOverflowing } from '@tmbk/canshift-core'

export interface OverflowingWidget {
  pageId: string
  widgetId: string
  type: Widget['type']
  layout: Widget['layout']
}

export const detectOverflow = (config: DashboardConfig): OverflowingWidget[] => {
  const out: OverflowingWidget[] = []
  for (const page of config.pages) {
    for (const widget of page.widgets) {
      if (isSpanOverflowing(widget.layout)) {
        out.push({ pageId: page.id, widgetId: widget.id, type: widget.type, layout: widget.layout })
      }
    }
  }
  return out
}
