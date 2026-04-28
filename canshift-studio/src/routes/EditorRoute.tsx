// EditorRoute.tsx — Dashboard layout editor (main editor view)
//
// TODO: Implement drag-drop canvas for 320×240 widget layout
// TODO: Implement widget palette (drag widget types onto canvas)
// TODO: Implement property panel (edit selected widget properties)
// TODO: Implement page navigation (add/remove/reorder pages)

import { useDashboardStore } from '../stores/dashboard.store'

export default function EditorRoute() {
  const config         = useDashboardStore((s) => s.config)
  const selectedPageId = useDashboardStore((s) => s.selectedPageId)
  const selectPage     = useDashboardStore((s) => s.selectPage)

  if (!config) {
    return (
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16,
        color: '#555555',
      }}>
        <p style={{ fontSize: 18 }}>No config loaded</p>
        <p style={{ fontSize: 13 }}>File → Open Config to load a dashboard.json</p>
        <p style={{ fontSize: 11, color: '#333333' }}>
          Or open an example from: dash-firmware/data/config/dashboard.json
        </p>
      </div>
    )
  }

  const currentPage = config.pages.find((p) => p.id === selectedPageId) ?? config.pages[0]

  return (
    <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
      {/* Page list sidebar */}
      <aside style={{
        width: 160,
        background: '#1A1A1A',
        borderRight: '1px solid #2A2A2A',
        padding: 8,
        overflowY: 'auto',
      }}>
        <div style={{ fontSize: 11, color: '#555555', marginBottom: 8, textTransform: 'uppercase' }}>
          Pages
        </div>
        {config.pages.map((page) => (
          <div
            key={page.id}
            onClick={() => selectPage(page.id)}
            style={{
              padding: '6px 8px',
              borderRadius: 4,
              cursor: 'pointer',
              fontSize: 13,
              background: page.id === selectedPageId ? '#2A2A2A' : 'transparent',
              color: page.id === selectedPageId ? '#FFFFFF' : '#888888',
            }}
          >
            {page.name}
          </div>
        ))}
      </aside>

      {/* Canvas area — 320×240 preview */}
      <main style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#111111',
        overflow: 'auto',
      }}>
        <div style={{
          position: 'relative',
          width: 320 * 2,   // 2× zoom for comfort
          height: 240 * 2,
          background: currentPage?.backgroundColor ?? '#111111',
          border: '1px solid #3A3A3A',
          transform: 'scale(1)',
          transformOrigin: 'top left',
        }}>
          {/* TODO: Render widget previews here */}
          <div style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#333333',
            fontSize: 12,
          }}>
            Canvas — widget rendering TODO
            <br />
            Page: {currentPage?.name} ({currentPage?.widgets.length} widgets)
          </div>
        </div>
      </main>

      {/* Property panel */}
      <aside style={{
        width: 240,
        background: '#1A1A1A',
        borderLeft: '1px solid #2A2A2A',
        padding: 12,
        overflowY: 'auto',
      }}>
        <div style={{ fontSize: 11, color: '#555555', marginBottom: 8, textTransform: 'uppercase' }}>
          Properties
        </div>
        <p style={{ color: '#555555', fontSize: 12 }}>
          Select a widget on the canvas to edit its properties.
        </p>
        {/* TODO: Render selected widget property form */}
      </aside>
    </div>
  )
}
