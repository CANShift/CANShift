import { useCallback } from 'react'
import type { Widget } from '@tmbk/canshift-core'

import { useDashboardConfig } from '../../hooks/useDashboardConfig'
import { useSignalStore } from '../../stores/signal.store'
import { PageConfigPanel } from './property-panel/panels/page-config-panel'
import { WidgetEditorPanel } from './property-panel/panels/widget-editor-panel'

const PANEL_HINT = '#333333'

interface PropertyPanelProps {
  pageId: string
}

const PropertyPanel = ({ pageId }: PropertyPanelProps) => {
  const {
    config,
    selectedWidgetId,
    updateWidget,
    removeWidget,
    addPage,
    removePage,
    setTargetProfile,
  } = useDashboardConfig()
  const signals = useSignalStore((s) => s.signals)

  const page = config?.pages.find((p) => p.id === pageId)
  const widget = page?.widgets.find((w) => w.id === selectedWidgetId)
  const widgetId = widget?.id

  const patch = useCallback(
    (p: Partial<Widget>) => {
      if (!widgetId) return
      updateWidget(pageId, widgetId, p)
    },
    [updateWidget, pageId, widgetId]
  )

  if (!widget) {
    if (!page || !config) {
      return (
        <div style={{ padding: 12 }}>
          <p style={{ color: PANEL_HINT, fontSize: 11 }}>No config loaded.</p>
        </div>
      )
    }
    return (
      <PageConfigPanel
        config={config}
        setTargetProfile={setTargetProfile}
        addPage={addPage}
        removePage={removePage}
      />
    )
  }

  return (
    <WidgetEditorPanel
      pageId={pageId}
      widget={widget}
      signals={signals}
      patch={patch}
      onRemove={removeWidget}
    />
  )
}

export default PropertyPanel
