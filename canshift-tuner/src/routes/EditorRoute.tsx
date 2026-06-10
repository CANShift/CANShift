import { useState, useRef, useEffect, useCallback, lazy, Suspense } from 'react'
import type { PageConfig } from '@tmbk/canshift-core'
import { DEFAULT_PAGE_PALETTE, FIRMWARE_CAPS, HexColorSchema } from '@tmbk/canshift-core'
import { useDashboardStore } from '../stores/dashboard.store'
import { PageThumbnail } from './PageThumbnail'
import { PageContextMenu } from './PageContextMenu'
import { RightSidebar } from './RightSidebar'
import { ErrorBoundary } from '../components/ErrorBoundary'

const Canvas = lazy(() => import('../components/editor/Canvas'))
const WidgetPalette = lazy(() => import('../components/editor/WidgetPalette'))

const NEW_PAGE_BG = HexColorSchema.parse('#000000')

const DEFAULT_PAGE_GLYPH = '★'
const NON_DEFAULT_PAGE_GLYPH = '☆'

const generateId = (prefix: string): string => {
  return `${prefix}_${Date.now().toString(36)}`
}

const CanvasFallback = () => {
  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#3A3A3A',
        fontSize: 12,
      }}
    >
      Loading editor…
    </div>
  )
}

const PaletteFallback = () => {
  return <div style={{ minHeight: 40 }} />
}

export default function EditorRoute() {
  const config = useDashboardStore((s) => s.config)
  const selectedPageId = useDashboardStore((s) => s.selectedPageId)
  const selectPage = useDashboardStore((s) => s.selectPage)
  const addPage = useDashboardStore((s) => s.addPage)
  const removePage = useDashboardStore((s) => s.removePage)
  const setDefaultPage = useDashboardStore((s) => s.setDefaultPage)
  const movePage = useDashboardStore((s) => s.movePage)
  const updatePage = useDashboardStore((s) => s.updatePage)

  const selectedWidgetId = useDashboardStore((s) => s.selectedWidgetId)

  const [contextMenu, setContextMenu] = useState<{
    pageId: string
    x: number
    y: number
  } | null>(null)

  const dragFromIndex = useRef<number | null>(null)

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key !== 'Delete' && e.key !== 'Backspace') return
      if (document.activeElement?.tagName === 'INPUT') return
      if (selectedWidgetId) return
      if (!selectedPageId || !config || config.pages.length <= 1) return
      removePage(selectedPageId)
    },
    [selectedPageId, config, removePage, selectedWidgetId]
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
      widgets: page.widgets.map((w) => ({ ...w, id: generateId(w.type) })),
    }
    const originalLength = config.pages.length
    addPage(newPage)
    if (originalIndex + 1 < originalLength) {
      movePage(originalLength, originalIndex + 1)
    }
  }

  return (
    <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
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
        <div style={{ padding: '8px 8px 0' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'baseline',
              justifyContent: 'space-between',
              marginBottom: 6,
            }}
          >
            <span
              style={{
                fontSize: 10,
                color: '#AAAAAA',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
              }}
            >
              Pages
            </span>
            <span
              style={{
                fontSize: 10,
                color: config.pages.length >= FIRMWARE_CAPS.MAX_PAGES ? '#E08030' : '#666666',
                fontFamily: 'monospace',
              }}
              title={`Firmware accepts at most ${FIRMWARE_CAPS.MAX_PAGES.toString()} pages`}
            >
              {config.pages.length}/{FIRMWARE_CAPS.MAX_PAGES}
            </span>
          </div>

          {config.pages.map((page, index) => {
            const isDefault = page.id === config.defaultPageId
            const isSelected = page.id === (selectedPageId ?? config.pages[0]?.id)
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
                  selectPage(page.id)
                }}
                onContextMenu={(e) => {
                  e.preventDefault()
                  setContextMenu({ pageId: page.id, x: e.clientX, y: e.clientY })
                }}
                style={{
                  marginBottom: 8,
                  cursor: 'pointer',
                  opacity: isVisible ? 1 : 0.45,
                }}
              >
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
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      setDefaultPage(page.id)
                    }}
                    title={isDefault ? 'Default page (shown at boot)' : 'Set as default'}
                    style={{
                      position: 'absolute',
                      top: 2,
                      left: 2,
                      width: 18,
                      height: 18,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: isDefault ? '#000000AA' : '#00000055',
                      border: 'none',
                      borderRadius: 3,
                      padding: 0,
                      cursor: 'pointer',
                      fontSize: 12,
                      lineHeight: 1,
                      color: isDefault ? '#FFAA00' : '#666666',
                    }}
                  >
                    {isDefault ? DEFAULT_PAGE_GLYPH : NON_DEFAULT_PAGE_GLYPH}
                  </button>
                  {config.pages.length > 1 && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        removePage(page.id)
                      }}
                      title="Remove page"
                      style={{
                        position: 'absolute',
                        top: 2,
                        right: 2,
                        width: 18,
                        height: 18,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: '#00000055',
                        border: 'none',
                        borderRadius: 3,
                        padding: 0,
                        color: '#888888',
                        cursor: 'pointer',
                        fontSize: 14,
                        lineHeight: 1,
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.color = '#FF6666'
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.color = '#888888'
                      }}
                    >
                      ×
                    </button>
                  )}
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
              </div>
            )
          })}

          {(() => {
            const atCap = config.pages.length >= FIRMWARE_CAPS.MAX_PAGES
            return (
              <button
                disabled={atCap}
                onClick={() => {
                  if (atCap) return
                  addPage({
                    id: generateId('page'),
                    backgroundImage: null,
                    backgroundColor: NEW_PAGE_BG,
                    palette: { ...DEFAULT_PAGE_PALETTE },
                    showTopBar: true,
                    visible: true,
                    widgets: [],
                  })
                }}
                title={
                  atCap
                    ? `Firmware accepts at most ${FIRMWARE_CAPS.MAX_PAGES.toString()} pages — remove one to add another`
                    : 'Add a new page'
                }
                style={{
                  width: '100%',
                  padding: '5px 0',
                  marginBottom: 8,
                  background: 'transparent',
                  border: '1px dashed #2A2A2A',
                  borderRadius: 4,
                  color: atCap ? '#444444' : '#AAAAAA',
                  cursor: atCap ? 'not-allowed' : 'pointer',
                  fontSize: 11,
                }}
                onMouseEnter={(e) => {
                  if (atCap) return
                  e.currentTarget.style.borderColor = '#AAAAAA'
                  e.currentTarget.style.color = '#888888'
                }}
                onMouseLeave={(e) => {
                  if (atCap) return
                  e.currentTarget.style.borderColor = '#2A2A2A'
                  e.currentTarget.style.color = '#AAAAAA'
                }}
              >
                + Page
              </button>
            )
          })()}
        </div>

        <div style={{ height: 1, background: '#222222', flexShrink: 0 }} />

        <div style={{ padding: '4px 0' }}>
          {currentPage && (
            <Suspense fallback={<PaletteFallback />}>
              <WidgetPalette pageId={currentPage.id} />
            </Suspense>
          )}
        </div>
      </aside>

      {currentPage ? (
        <ErrorBoundary scope="canvas">
          <Suspense fallback={<CanvasFallback />}>
            <Canvas page={currentPage} topBar={config.topBar} />
          </Suspense>
        </ErrorBoundary>
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

      <RightSidebar pageId={currentPage?.id} />

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
