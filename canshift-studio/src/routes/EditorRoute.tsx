// EditorRoute.tsx — Dashboard layout editor

import { useState, useRef, useEffect, useCallback } from 'react'
import type { PageConfig, TopBarConfig } from '@tmbk/canshift-core'
import { DEFAULT_PAGE_PALETTE } from '@tmbk/canshift-core'
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
// Context menu
// ---------------------------------------------------------------------------

interface ContextMenuProps {
  pageId: string
  x: number
  y: number
  isDefault: boolean
  isVisible: boolean
  canDelete: boolean
  onClose: () => void
  onDuplicate: () => void
  onSetDefault: () => void
  onToggleVisible: () => void
  onDelete: () => void
}

function PageContextMenu({
  x,
  y,
  isDefault,
  isVisible,
  canDelete,
  onClose,
  onDuplicate,
  onSetDefault,
  onToggleVisible,
  onDelete,
}: ContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', close)
    return () => {
      document.removeEventListener('mousedown', close)
    }
  }, [onClose])

  const items: {
    label: string
    action: () => void
    danger?: boolean
    disabled?: boolean
  }[] = [
    { label: 'Duplicate', action: onDuplicate },
    {
      label: isDefault ? 'Default ◆' : 'Set as default',
      action: onSetDefault,
      disabled: isDefault,
    },
    { label: isVisible ? 'Hide page' : 'Show page', action: onToggleVisible },
    { label: 'Delete', action: onDelete, danger: true, disabled: !canDelete },
  ]

  return (
    <div
      ref={ref}
      style={{
        position: 'fixed',
        top: y,
        left: x,
        zIndex: 9999,
        background: '#1A1A1A',
        border: '1px solid #2A2A2A',
        borderRadius: 5,
        padding: '3px 0',
        minWidth: 140,
        boxShadow: '0 4px 16px #00000066',
      }}
    >
      {items.map((item) => (
        <button
          key={item.label}
          disabled={item.disabled}
          onClick={() => {
            if (!item.disabled) {
              item.action()
              onClose()
            }
          }}
          style={{
            display: 'block',
            width: '100%',
            textAlign: 'left',
            padding: '5px 12px',
            background: 'none',
            border: 'none',
            fontSize: 12,
            color: item.disabled ? '#333333' : item.danger ? '#CC4444' : '#CCCCCC',
            cursor: item.disabled ? 'default' : 'pointer',
          }}
          onMouseEnter={(e) => {
            if (!item.disabled)
              e.currentTarget.style.background = item.danger ? '#2A1111' : '#252525'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'none'
          }}
        >
          {item.label}
        </button>
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
  const movePage = useDashboardStore((s) => s.movePage)
  const updatePage = useDashboardStore((s) => s.updatePage)

  const [editingPageId, setEditingPageId] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState('')
  const [contextMenu, setContextMenu] = useState<{
    pageId: string
    x: number
    y: number
  } | null>(null)

  const renameInputRef = useRef<HTMLInputElement>(null)
  const dragFromIndex = useRef<number | null>(null)

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

  // Keyboard: Delete key removes selected page
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key !== 'Delete' && e.key !== 'Backspace') return
      if (document.activeElement?.tagName === 'INPUT') return
      if (!selectedPageId || !config || config.pages.length <= 1) return
      removePage(selectedPageId)
    },
    [selectedPageId, config, removePage]
  )

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [handleKeyDown])

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
          color: '#AAAAAA',
        }}
      >
        <div style={{ fontSize: 32, opacity: 0.2 }}>◫</div>
        <p style={{ fontSize: 14, color: '#3A3A3A' }}>No config loaded</p>
        <p style={{ fontSize: 11, color: '#2E2E2E' }}>Use the Load button in the toolbar</p>
      </div>
    )
  }

  const currentPage = config.pages.find((p) => p.id === selectedPageId) ?? config.pages[0]

  const handleDuplicate = (pageId: string) => {
    const page = config.pages.find((p) => p.id === pageId)
    if (!page) return
    const originalIndex = config.pages.findIndex((p) => p.id === pageId)
    const newPage: PageConfig = {
      ...page,
      id: generateId('page'),
      name: `${page.name} copy`,
      widgets: page.widgets.map((w) => ({ ...w, id: generateId(w.type) })),
    }
    const originalLength = config.pages.length
    addPage(newPage)
    // Move new page (now at originalLength) to right after original
    if (originalIndex + 1 < originalLength) {
      movePage(originalLength, originalIndex + 1)
    }
  }

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
              color: '#AAAAAA',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              marginBottom: 6,
            }}
          >
            Pages
          </div>

          {config.pages.map((page, index) => {
            const isDefault = page.id === config.defaultPageId
            const isSelected = page.id === (selectedPageId ?? config.pages[0]?.id)
            const isEditing = editingPageId === page.id
            const isVisible = page.visible !== false

            return (
              <div
                key={page.id}
                draggable
                onDragStart={() => {
                  dragFromIndex.current = index
                }}
                onDragOver={(e) => {
                  e.preventDefault()
                }}
                onDrop={() => {
                  if (dragFromIndex.current !== null && dragFromIndex.current !== index) {
                    movePage(dragFromIndex.current, index)
                  }
                  dragFromIndex.current = null
                }}
                onDragEnd={() => {
                  dragFromIndex.current = null
                }}
                onClick={() => {
                  if (!isEditing) selectPage(page.id)
                }}
                onContextMenu={(e) => {
                  e.preventDefault()
                  setContextMenu({ pageId: page.id, x: e.clientX, y: e.clientY })
                }}
                style={{
                  marginBottom: 8,
                  cursor: isEditing ? 'default' : 'pointer',
                  opacity: isVisible ? 1 : 0.45,
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
                    position: 'relative',
                  }}
                >
                  <PageThumbnail page={page} topBar={config.topBar} />
                  {/* Hidden badge */}
                  {!isVisible && (
                    <div
                      style={{
                        position: 'absolute',
                        inset: 0,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: '#00000055',
                        fontSize: 16,
                        color: '#888888',
                      }}
                    >
                      ◌
                    </div>
                  )}
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
                palette: { ...DEFAULT_PAGE_PALETTE },
                showTopBar: true,
                visible: true,
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
              color: '#AAAAAA',
              cursor: 'pointer',
              fontSize: 11,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = '#AAAAAA'
              e.currentTarget.style.color = '#888888'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = '#2A2A2A'
              e.currentTarget.style.color = '#AAAAAA'
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

      {/* ── Context menu ─────────────────────────────────────────────────── */}
      {contextMenu && (
        <PageContextMenu
          pageId={contextMenu.pageId}
          x={contextMenu.x}
          y={contextMenu.y}
          isDefault={contextMenu.pageId === config.defaultPageId}
          isVisible={config.pages.find((p) => p.id === contextMenu.pageId)?.visible ?? true}
          canDelete={config.pages.length > 1}
          onClose={() => {
            setContextMenu(null)
          }}
          onDuplicate={() => {
            handleDuplicate(contextMenu.pageId)
          }}
          onSetDefault={() => {
            setDefaultPage(contextMenu.pageId)
          }}
          onToggleVisible={() => {
            const page = config.pages.find((p) => p.id === contextMenu.pageId)
            if (page) updatePage(contextMenu.pageId, { visible: !page.visible })
          }}
          onDelete={() => {
            removePage(contextMenu.pageId)
          }}
        />
      )}
    </div>
  )
}
