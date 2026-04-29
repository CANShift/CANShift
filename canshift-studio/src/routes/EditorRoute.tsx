// EditorRoute.tsx — Dashboard layout editor

import { useState, useRef, useEffect } from 'react'
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
  const renamePage = useDashboardStore((s) => s.renamePage)
  const setDefaultPage = useDashboardStore((s) => s.setDefaultPage)

  // Inline rename state: pageId being edited → draft name
  const [editingPageId, setEditingPageId] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState('')
  const renameInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editingPageId && renameInputRef.current) renameInputRef.current.select()
  }, [editingPageId])

  const startRename = (pageId: string, currentName: string) => {
    setEditingPageId(pageId)
    setEditDraft(currentName)
  }

  const commitRename = () => {
    if (editingPageId && editDraft.trim()) renamePage(editingPageId, editDraft.trim())
    setEditingPageId(null)
  }

  if (!config) {
    return (
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          color: '#555555',
        }}
      >
        <div style={{ fontSize: 32, opacity: 0.2 }}>◫</div>
        <p style={{ fontSize: 14, color: '#3A3A3A' }}>No config loaded</p>
        <p style={{ fontSize: 11, color: '#2E2E2E' }}>Use the Load button in the toolbar</p>
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
          {config.pages.map((page) => {
            const isDefault = page.id === config.defaultPageId
            const isSelected = page.id === selectedPageId
            const isEditing = editingPageId === page.id

            return (
              <div
                key={page.id}
                onClick={() => {
                  if (!isEditing) selectPage(page.id)
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 3,
                  padding: '4px 6px',
                  borderRadius: 4,
                  cursor: isEditing ? 'default' : 'pointer',
                  fontSize: 12,
                  background: isSelected ? '#2A2A2A' : 'transparent',
                  color: isSelected ? '#FFFFFF' : '#777777',
                  marginBottom: 1,
                }}
              >
                {/* Default page indicator — click to set as default */}
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    setDefaultPage(page.id)
                  }}
                  title={isDefault ? 'Default page' : 'Set as default page'}
                  style={{
                    background: 'none',
                    border: 'none',
                    padding: 0,
                    cursor: 'pointer',
                    fontSize: 10,
                    lineHeight: 1,
                    color: isDefault ? '#FF8800' : '#333333',
                    flexShrink: 0,
                  }}
                >
                  ◆
                </button>

                {/* Page name — double-click to rename */}
                {isEditing ? (
                  <input
                    ref={renameInputRef}
                    value={editDraft}
                    onChange={(e) => {
                      setEditDraft(e.target.value)
                    }}
                    onBlur={commitRename}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') commitRename()
                      if (e.key === 'Escape') setEditingPageId(null)
                    }}
                    onClick={(e) => {
                      e.stopPropagation()
                    }}
                    style={{
                      flex: 1,
                      background: '#111111',
                      border: '1px solid #5566AA',
                      borderRadius: 2,
                      color: '#FFFFFF',
                      fontSize: 12,
                      padding: '1px 4px',
                      outline: 'none',
                      minWidth: 0,
                    }}
                  />
                ) : (
                  <span
                    onDoubleClick={(e) => {
                      e.stopPropagation()
                      startRename(page.id, page.name)
                    }}
                    title="Double-click to rename"
                    style={{
                      flex: 1,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {page.name}
                  </span>
                )}

                {/* Delete button */}
                {config.pages.length > 1 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      removePage(page.id)
                    }}
                    title="Remove page"
                    style={{
                      padding: '0 2px',
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
            )
          })}
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
        <Canvas page={currentPage} topBar={config.topBar} />
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
