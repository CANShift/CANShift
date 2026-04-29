// EditorRoute.tsx — Dashboard layout editor

import { useState, useRef, useEffect } from 'react'
import type { PageConfig, TopBarConfig } from '@tmbk/canshift-core'
import { useDashboardStore } from '../stores/dashboard.store'
import Canvas from '../components/editor/Canvas'
import WidgetPalette from '../components/editor/WidgetPalette'
import PropertyPanel from '../components/editor/PropertyPanel'
import { WidgetPreview } from '../components/editor/WidgetPreview'

// ---------------------------------------------------------------------------
// Page thumbnail — mini read-only render of one page
// ---------------------------------------------------------------------------

const THUMB_W = 128 // px
const THUMB_H = Math.round((THUMB_W * 240) / 320) // 96px
const THUMB_SCALE = THUMB_W / 320

interface PageThumbnailProps {
  page: PageConfig
  topBar: TopBarConfig
}

function PageThumbnail({ page, topBar }: PageThumbnailProps) {
  const barH = page.showTopBar ? topBar.height * THUMB_SCALE : 0

  return (
    <div
      style={{
        width: THUMB_W,
        height: THUMB_H,
        background: page.backgroundColor,
        overflow: 'hidden',
        position: 'relative',
        borderRadius: 2,
        flexShrink: 0,
      }}
    >
      {/* Top bar stripe */}
      {page.showTopBar && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: barH,
            background: topBar.bgColor,
            borderBottom: '1px solid #1E1E1E',
          }}
        />
      )}

      {/* Widgets */}
      {page.widgets.map((widget) => (
        <div
          key={widget.id}
          style={{
            position: 'absolute',
            left: widget.layout.x * THUMB_SCALE,
            top: barH + widget.layout.y * THUMB_SCALE,
            width: widget.layout.w * THUMB_SCALE,
            height: widget.layout.h * THUMB_SCALE,
            overflow: 'hidden',
          }}
        >
          <WidgetPreview
            widget={widget}
            displayW={widget.layout.w * THUMB_SCALE}
            displayH={widget.layout.h * THUMB_SCALE}
          />
        </div>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// ID generator
// ---------------------------------------------------------------------------

function generateId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}`
}

// ---------------------------------------------------------------------------
// Route
// ---------------------------------------------------------------------------

export default function EditorRoute() {
  const config = useDashboardStore((s) => s.config)
  const selectedPageId = useDashboardStore((s) => s.selectedPageId)
  const selectPage = useDashboardStore((s) => s.selectPage)
  const addPage = useDashboardStore((s) => s.addPage)
  const removePage = useDashboardStore((s) => s.removePage)
  const renamePage = useDashboardStore((s) => s.renamePage)
  const setDefaultPage = useDashboardStore((s) => s.setDefaultPage)

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
      {/* ── Left sidebar: pages (as thumbnails) + widget palette ─────────── */}
      <aside
        style={{
          width: 152,
          background: '#161616',
          borderRight: '1px solid #222222',
          display: 'flex',
          flexDirection: 'column',
          overflowY: 'auto',
          overflowX: 'hidden',
        }}
      >
        {/* Pages section */}
        <div style={{ padding: '8px 8px 0' }}>
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
            const isSelected = page.id === (selectedPageId ?? config.pages[0]?.id)
            const isEditing = editingPageId === page.id

            return (
              <div
                key={page.id}
                onClick={() => {
                  if (!isEditing) selectPage(page.id)
                }}
                style={{
                  marginBottom: 8,
                  cursor: isEditing ? 'default' : 'pointer',
                }}
              >
                {/* Thumbnail */}
                <div
                  style={{
                    border: `2px solid ${isSelected ? '#FFFFFF' : '#2A2A2A'}`,
                    borderRadius: 4,
                    overflow: 'hidden',
                    boxShadow: isSelected ? '0 0 0 1px #FFFFFF22' : 'none',
                    transition: 'border-color 0.1s',
                  }}
                >
                  <PageThumbnail page={page} topBar={config.topBar} />
                </div>

                {/* Page name row */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 3,
                    marginTop: 4,
                    fontSize: 11,
                    color: isSelected ? '#FFFFFF' : '#666666',
                  }}
                >
                  {/* Default marker */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      setDefaultPage(page.id)
                    }}
                    title={isDefault ? 'Default page' : 'Set as default'}
                    style={{
                      background: 'none',
                      border: 'none',
                      padding: 0,
                      cursor: 'pointer',
                      fontSize: 9,
                      lineHeight: 1,
                      color: isDefault ? '#FF8800' : '#333333',
                      flexShrink: 0,
                    }}
                  >
                    ◆
                  </button>

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
                        fontSize: 11,
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
                        color: '#333333',
                        cursor: 'pointer',
                        fontSize: 12,
                        lineHeight: 1,
                        flexShrink: 0,
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.color = '#AA3333'
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.color = '#333333'
                      }}
                    >
                      ×
                    </button>
                  )}
                </div>
              </div>
            )
          })}

          {/* Add page button */}
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
              width: '100%',
              padding: '5px 0',
              marginBottom: 8,
              background: 'transparent',
              border: '1px dashed #2A2A2A',
              borderRadius: 4,
              color: '#444444',
              cursor: 'pointer',
              fontSize: 11,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = '#555555'
              e.currentTarget.style.color = '#888888'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = '#2A2A2A'
              e.currentTarget.style.color = '#444444'
            }}
          >
            + Page
          </button>
        </div>

        {/* Separator */}
        <div style={{ height: 1, background: '#222222', flexShrink: 0 }} />

        {/* Widget palette */}
        <div style={{ padding: '4px 0' }}>
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
