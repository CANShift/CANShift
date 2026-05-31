// RightSidebar.tsx — Right-hand sidebar of the editor: tab strip + active panel.
//
// Tab state is encapsulated here so EditorRoute only owns the page selection;
// the sidebar decides for itself which panel is visible. Extending with extra
// tabs is a one-row change to `TABS`.
//
// Mirrors the chrome of the page-list pills above so the right sidebar reads
// like one continuous surface (issue #21).

import { useState } from 'react'
import PropertyPanel from '../components/editor/PropertyPanel'
import Obd2PollingPanel from '../components/editor/Obd2PollingPanel'

type Tab = 'properties' | 'signals'

const TABS: { id: Tab; label: string }[] = [
  { id: 'properties', label: 'Properties' },
  // Signals tab — per-signal input-mode editor (broadcast vs OBD-II polling,
  // issue #841). Lets a user switch a signal's source without leaving the
  // editor.
  { id: 'signals', label: 'Signals' },
]

const TAB_ACTIVE_BG = '#1F1F1F'
const TAB_ACTIVE_FG = '#FFFFFF'
const TAB_IDLE_FG = '#777777'
const TAB_BORDER = '#222222'

export interface RightSidebarProps {
  /** Currently selected page — `undefined` when no page is selected. */
  pageId: string | undefined
}

export function RightSidebar({ pageId }: RightSidebarProps) {
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
      {tab === 'properties' && pageId !== undefined && <PropertyPanel pageId={pageId} />}
      {tab === 'signals' && <Obd2PollingPanel />}
    </aside>
  )
}
