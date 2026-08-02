import { lazy, Suspense, useState } from 'react'
import type { CSSProperties } from 'react'

const PropertyPanel = lazy(() => import('../components/editor/PropertyPanel'))
const SignalsPanel = lazy(() => import('../components/editor/SignalsPanel'))
const WidgetPalette = lazy(() => import('../components/editor/WidgetPalette'))
const WidgetListPanel = lazy(() => import('../components/editor/WidgetListPanel'))
const HistoryPanel = lazy(() => import('../components/editor/HistoryPanel'))

type Tab = 'properties' | 'widgets' | 'signals' | 'library' | 'history'

const TABS: { id: Tab; label: string }[] = [
  { id: 'properties', label: 'PROPERTIES' },
  { id: 'widgets', label: 'WIDGETS' },
  { id: 'signals', label: 'SIGNALS' },
  { id: 'library', label: 'LIBRARY' },
  { id: 'history', label: 'HISTORY' },
]

export interface RightSidebarProps {
  pageId: string | undefined
}

const PanelFallback = () => <div style={fallbackStyle}>Loading…</div>

export const RightSidebar = ({ pageId }: RightSidebarProps) => {
  const [tab, setTab] = useState<Tab>('properties')

  return (
    <aside style={asideStyle}>
      <div role="tablist" aria-label="Editor sidebar tabs" style={tabListStyle}>
        {TABS.map((t) => {
          const isActive = tab === t.id
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => {
                setTab(t.id)
              }}
              className={isActive ? undefined : 'shell-nav-item'}
              style={tabStyle(isActive)}
            >
              {t.label}
              {isActive && <span aria-hidden="true" style={tabBarStyle} />}
            </button>
          )
        })}
      </div>
      {tab === 'properties' && pageId !== undefined && (
        <Suspense fallback={<PanelFallback />}>
          <PropertyPanel pageId={pageId} />
        </Suspense>
      )}
      {tab === 'widgets' && pageId !== undefined && (
        <Suspense fallback={<PanelFallback />}>
          <WidgetListPanel pageId={pageId} />
        </Suspense>
      )}
      {tab === 'signals' && (
        <Suspense fallback={<PanelFallback />}>
          <SignalsPanel />
        </Suspense>
      )}
      {tab === 'library' && pageId !== undefined && (
        <Suspense fallback={<PanelFallback />}>
          <WidgetPalette pageId={pageId} />
        </Suspense>
      )}
      {tab === 'history' && (
        <Suspense fallback={<PanelFallback />}>
          <HistoryPanel />
        </Suspense>
      )}
    </aside>
  )
}

const asideStyle: CSSProperties = {
  width: 320,
  flexShrink: 0,
  borderLeft: '2px solid var(--brand-divider)',
  display: 'flex',
  flexDirection: 'column',
  minHeight: 0,
  overflow: 'hidden',
}

const tabListStyle: CSSProperties = {
  display: 'flex',
  borderBottom: '2px solid var(--brand-divider)',
  flexShrink: 0,
}

const tabStyle = (active: boolean): CSSProperties => ({
  position: 'relative',
  flex: 1,
  padding: '11px 0',
  background: 'none',
  border: 0,
  fontWeight: 800,
  fontSize: 9,
  letterSpacing: '0.06em',
  color: active ? 'hsl(var(--brand-text))' : 'hsl(var(--brand-neutral-600))',
  cursor: 'pointer',
})

const tabBarStyle: CSSProperties = {
  position: 'absolute',
  left: 0,
  right: 0,
  bottom: 0,
  height: 3,
  background: 'hsl(var(--brand-accent))',
}

const fallbackStyle: CSSProperties = {
  flex: 1,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: 'hsl(var(--brand-neutral-500))',
  fontSize: 11,
}
