import type { CSSProperties } from 'react'
import { useDashboardStore } from '../../stores/dashboard.store'
import { MONO_FONT } from '../../lib/typography'

interface WidgetListPanelProps {
  pageId: string
}

const WidgetListPanel = ({ pageId }: WidgetListPanelProps) => {
  const pages = useDashboardStore((s) => s.config?.pages)
  const selectedWidgetId = useDashboardStore((s) => s.selectedWidgetId)
  const selectWidget = useDashboardStore((s) => s.selectWidget)

  const pageIndex = pages?.findIndex((p) => p.id === pageId) ?? -1
  const page = pageIndex >= 0 ? pages?.[pageIndex] : undefined
  if (!page) return null

  return (
    <div style={panelStyle}>
      <div style={headerStyle}>
        <span>PAGE {pageIndex + 1}</span>
        <span>
          {page.widgets.length} widget{page.widgets.length === 1 ? '' : 's'}
        </span>
      </div>
      {page.widgets.length === 0 && <div style={emptyStyle}>No widgets on this page yet.</div>}
      {page.widgets.map((widget, index) => {
        const selected = widget.id === selectedWidgetId
        return (
          <button
            key={widget.id}
            type="button"
            className={selected ? undefined : 'shell-nav-item'}
            onClick={() => {
              selectWidget(widget.id)
            }}
            style={rowStyle(selected)}
          >
            {selected && <span aria-hidden="true" style={selectedBarStyle} />}
            <span style={indexStyle}>{String(index + 1).padStart(2, '0')}</span>
            <span style={nameStyle}>{widget.type}</span>
            <span style={signalStyle}>{widget.signal || '—'}</span>
          </button>
        )
      })}
    </div>
  )
}

const panelStyle: CSSProperties = {
  flex: 1,
  overflowY: 'auto',
}

const headerStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  padding: '12px 16px',
  borderBottom: '2px solid var(--brand-divider)',
  fontWeight: 800,
  fontSize: 10,
  letterSpacing: '0.18em',
  color: 'hsl(var(--brand-neutral-600))',
}

const emptyStyle: CSSProperties = {
  padding: '14px 16px',
  fontSize: 12,
  color: 'hsl(var(--brand-neutral-500))',
}

const rowStyle = (selected: boolean): CSSProperties => ({
  position: 'relative',
  width: '100%',
  display: 'flex',
  alignItems: 'center',
  gap: 9,
  padding: '9px 16px 9px 19px',
  background: selected ? 'hsl(var(--brand-neutral-200))' : 'none',
  border: 0,
  borderBottom: '1px solid hsl(var(--brand-neutral-200))',
  cursor: 'pointer',
  textAlign: 'left',
  color: selected ? 'hsl(var(--brand-text))' : 'hsl(var(--brand-neutral-700))',
})

const selectedBarStyle: CSSProperties = {
  position: 'absolute',
  left: 0,
  top: 0,
  bottom: 0,
  width: 3,
  background: 'hsl(var(--brand-accent))',
}

const indexStyle: CSSProperties = {
  width: 20,
  flexShrink: 0,
  fontFamily: MONO_FONT,
  fontSize: 10,
  color: 'hsl(var(--brand-neutral-600))',
}

const nameStyle: CSSProperties = {
  fontSize: 13,
}

const signalStyle: CSSProperties = {
  marginLeft: 'auto',
  fontFamily: MONO_FONT,
  fontSize: 10,
  color: 'hsl(var(--brand-neutral-600))',
}

export default WidgetListPanel
