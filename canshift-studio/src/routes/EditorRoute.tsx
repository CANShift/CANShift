// EditorRoute.tsx — Dashboard layout editor

import { useDashboardStore } from '../stores/dashboard.store'
import Canvas from '../components/editor/Canvas'
import WidgetPalette from '../components/editor/WidgetPalette'
import PropertyPanel from '../components/editor/PropertyPanel'

function generateId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}`
}

export default function EditorRoute() {
  const config = useDashboardStore((s) => s.config)
  const selectedPageId = useDashboardStore((s) => s.selectedPageId)
  const selectPage = useDashboardStore((s) => s.selectPage)
  const addPage = useDashboardStore((s) => s.addPage)
  const removePage = useDashboardStore((s) => s.removePage)

  if (!config) {
    return (
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 12,
          color: '#555555',
        }}
      >
        <div style={{ fontSize: 32, opacity: 0.3 }}>◫</div>
        <p style={{ fontSize: 16, color: '#444444' }}>No config loaded</p>
        <p style={{ fontSize: 12 }}>File → Open Config to load a dashboard.json</p>
        <p style={{ fontSize: 11, color: '#333333' }}>
          Example: canshift-firmware/data/config/dashboard.json
        </p>
      </div>
    )
  }

  const currentPage = config.pages.find((p) => p.id === selectedPageId) ?? config.pages[0]

  return (
    <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
      {/* ── Left sidebar: pages + widget palette ─────────────────────────── */}
      <aside
        style={{
          width: 152,
          background: '#161616',
          borderRight: '1px solid #222222',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Pages */}
        <div style={{ padding: 8, borderBottom: '1px solid #222222' }}>
          <div
            style={{
              fontSize: 10,
              color: '#555555',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              marginBottom: 6,
            }}
          >
            Pages
          </div>
          {config.pages.map((page) => (
            <div
              key={page.id}
              onClick={() => {
                selectPage(page.id)
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '5px 6px',
                borderRadius: 4,
                cursor: 'pointer',
                fontSize: 12,
                background: page.id === selectedPageId ? '#2A2A2A' : 'transparent',
                color: page.id === selectedPageId ? '#FFFFFF' : '#777777',
                marginBottom: 1,
              }}
            >
              <span
                style={{
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  flex: 1,
                }}
              >
                {page.name}
              </span>
              {config.pages.length > 1 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    removePage(page.id)
                  }}
                  title="Remove page"
                  style={{
                    marginLeft: 4,
                    padding: '0 3px',
                    background: 'none',
                    border: 'none',
                    color: '#444444',
                    cursor: 'pointer',
                    fontSize: 12,
                    lineHeight: 1,
                    flexShrink: 0,
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = '#AA3333'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = '#444444'
                  }}
                >
                  ×
                </button>
              )}
            </div>
          ))}
          <button
            onClick={() => {
              addPage({
                id: generateId('page'),
                name: `Page ${String(config.pages.length + 1)}`,
                backgroundImage: null,
                backgroundColor: '#111111',
                showTopBar: true,
                widgets: [],
              })
            }}
            style={{
              marginTop: 4,
              width: '100%',
              padding: '4px 0',
              background: 'transparent',
              border: '1px dashed #333333',
              borderRadius: 4,
              color: '#555555',
              cursor: 'pointer',
              fontSize: 11,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = '#555555'
              e.currentTarget.style.color = '#888888'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = '#333333'
              e.currentTarget.style.color = '#555555'
            }}
          >
            + Add page
          </button>
        </div>

        {/* Widget palette */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {currentPage && <WidgetPalette pageId={currentPage.id} />}
        </div>
      </aside>

      {/* ── Canvas centre ────────────────────────────────────────────────── */}
      {currentPage ? (
        <Canvas page={currentPage} />
      ) : (
        <div
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#333333',
          }}
        >
          No page selected
        </div>
      )}

      {/* ── Right sidebar: property panel ────────────────────────────────── */}
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
        {currentPage && <PropertyPanel pageId={currentPage.id} />}
      </aside>
    </div>
  )
}
