import { lazy, Suspense, useState } from 'react'
import Obd2PollingPanel from '../components/obd2/Obd2PollingPanel'

const PropertyPanel = lazy(() => import('../components/editor/PropertyPanel'))

type Tab = 'properties' | 'signals'

const TABS: { id: Tab; label: string }[] = [
  { id: 'properties', label: 'Properties' },
  { id: 'signals', label: 'Signals' },
]

const TAB_ACTIVE_BG = '#1F1F1F'
const TAB_ACTIVE_FG = '#FFFFFF'
const TAB_IDLE_FG = '#777777'
const TAB_BORDER = '#222222'

export interface RightSidebarProps {
  pageId: string | undefined
}

const PropertyPanelFallback = () => {
  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#3A3A3A',
        fontSize: 11,
      }}
    >
      Loading…
    </div>
  )
}

export const RightSidebar = ({ pageId }: RightSidebarProps) => {
  const [tab, setTab] = useState<Tab>('properties')

  return (
    <aside
      style={{
        width: 220,
        background: '#161616',
        borderLeft: '1px solid #222222',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      <div
        role="tablist"
        aria-label="Editor sidebar tabs"
        style={{
          display: 'flex',
          borderBottom: `1px solid ${TAB_BORDER}`,
          flexShrink: 0,
        }}
      >
        {TABS.map((t) => {
          const isActive = tab === t.id
          return (
            <button
              key={t.id}
              role="tab"
              aria-selected={isActive}
              onClick={() => {
                setTab(t.id)
              }}
              style={{
                flex: 1,
                padding: '8px 0',
                background: isActive ? TAB_ACTIVE_BG : 'transparent',
                border: 'none',
                borderBottom: isActive ? `1px solid ${TAB_ACTIVE_FG}` : '1px solid transparent',
                color: isActive ? TAB_ACTIVE_FG : TAB_IDLE_FG,
                cursor: 'pointer',
                fontSize: 11,
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                fontWeight: isActive ? 600 : 400,
              }}
            >
              {t.label}
            </button>
          )
        })}
      </div>
      {tab === 'properties' && pageId !== undefined && (
        <Suspense fallback={<PropertyPanelFallback />}>
          <PropertyPanel pageId={pageId} />
        </Suspense>
      )}
      {tab === 'signals' && <Obd2PollingPanel />}
    </aside>
  )
}
