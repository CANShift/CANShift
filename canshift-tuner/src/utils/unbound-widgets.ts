import type { DashboardConfig, Widget } from '@tmbk/canshift-core'
import { SIGNAL_CONSUMING_TYPES } from './default-widget'

export const isUnboundWidget = (widget: Widget): boolean =>
  SIGNAL_CONSUMING_TYPES.has(widget.type) && widget.signal === ''

export const unboundWidgetCount = (config: DashboardConfig | null): number =>
  config?.pages.reduce((acc, page) => acc + page.widgets.filter(isUnboundWidget).length, 0) ?? 0
