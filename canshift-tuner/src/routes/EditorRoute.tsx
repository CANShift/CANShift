import { memo, useState, useRef, useEffect, useCallback, lazy, Suspense } from 'react'
import { useShallow } from 'zustand/react/shallow'
import type { PageConfig, TopBarConfig } from '@tmbk/canshift-core'
import { DEFAULT_PAGE_PALETTE, FIRMWARE_CAPS, HexColorSchema } from '@tmbk/canshift-core'
import { useDashboardStore } from '../stores/dashboard.store'
import { PageThumbnail } from './PageThumbnail'
import { PageContextMenu } from './PageContextMenu'
import { RightSidebar } from './RightSidebar'
import { ErrorBoundary } from '../components/ErrorBoundary'
import { Button } from '@/components/ui/button'

const Canvas = lazy(() => import('../components/editor/Canvas'))
const WidgetPalette = lazy(() => import('../components/editor/WidgetPalette'))

const NEW_PAGE_BG = HexColorSchema.parse('#000000')

const DEFAULT_PAGE_GLYPH = '★'
const NON_DEFAULT_PAGE_GLYPH = '☆'

const generateId = (prefix: string): string => {
  return `${prefix}_${Date.now().toString(36)}`
}

interface PageListItemProps {
  page: PageConfig
  index: number
  isDefault: boolean
  isSelected: boolean
  canRemove: boolean
  topBar: TopBarConfig
  onSelect: (pageId: string) => void
  onDragStart: (index: number) => void
  onDrop: (toIndex: number) => void
  onSetDefault: (pageId: string) => void
  onRemove: (pageId: string) => void
  onContextMenu: (pageId: string, x: number, y: number) => void
}

const PageListItemImpl = ({
  page,
  index,
  isDefault,
  isSelected,
  canRemove,
  topBar,
  onSelect,
  onDragStart,
  onDrop,
  onSetDefault,
  onRemove,
  onContextMenu,
}: PageListItemProps) => {
  const isVisible = page.visible !== false
  return (
    <div
      draggable
      onDragStart={() => {
        onDragStart(index)
      }}
      onDragOver={(e) => {
        e.preventDefault()
      }}
      onDrop={() => {
        onDrop(index)
      }}
      onClick={() => {
        onSelect(page.id)
      }}
      onContextMenu={(e) => {
        e.preventDefault()
        onContextMenu(page.id, e.clientX, e.clientY)
      }}
      style={{
        marginBottom: 8,
        cursor: 'pointer',
        opacity: isVisible ? 1 : 0.45,
      }}
    >
      <div
        style={{
          border: `2px solid ${isSelected ? 'hsl(var(--text))' : 'hsl(var(--border))'}`,
          borderRadius: 4,
          overflow: 'hidden',
          boxShadow: isSelected ? '0 0 0 1px hsl(var(--text) / 0.13)' : 'none',
          transition: 'border-color 0.1s',
          position: 'relative',
        }}
      >
        <PageThumbnail page={page} topBar={topBar} />
        <button
          onClick={(e) => {
            e.stopPropagation()
            onSetDefault(page.id)
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
            background: isDefault ? 'rgba(0, 0, 0, 0.67)' : 'rgba(0, 0, 0, 0.33)',
            border: 'none',
            borderRadius: 3,
            padding: 0,
            cursor: 'pointer',
            fontSize: 12,
            lineHeight: 1,
            color: isDefault ? 'hsl(var(--accent))' : 'hsl(var(--text-muted))',
          }}
        >
          {isDefault ? DEFAULT_PAGE_GLYPH : NON_DEFAULT_PAGE_GLYPH}
        </button>
        {canRemove && (
          <button
            onClick={(e) => {
              e.stopPropagation()
              onRemove(page.id)
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
              background: 'rgba(0, 0, 0, 0.33)',
              border: 'none',
              borderRadius: 3,
              padding: 0,
              color: 'hsl(var(--text-dim))',
              cursor: 'pointer',
              fontSize: 14,
              lineHeight: 1,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = 'hsl(var(--destructive))'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = 'hsl(var(--text-dim))'
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
              background: 'rgba(0, 0, 0, 0.33)',
              fontSize: 16,
              color: 'hsl(var(--text-dim))',
            }}
          >
            ◌
          </div>
        )}
      </div>
    </div>
  )
}

const PageListItem = memo(PageListItemImpl)

const CanvasFallback = () => {
  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'hsl(var(--text-muted))',
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

const EditorRoute = () => {
  const pages = useDashboardStore((s) => s.config?.pages)
  const topBar = useDashboardStore((s) => s.config?.topBar)
  const defaultPageId = useDashboardStore((s) => s.config?.defaultPageId)
  const selectedPageId = useDashboardStore((s) => s.selectedPageId)
  const selectedWidgetId = useDashboardStore((s) => s.selectedWidgetId)

  const { selectPage, addPage, removePage, setDefaultPage, movePage, updatePage } =
    useDashboardStore(
      useShallow((s) => ({
        selectPage: s.selectPage,
        addPage: s.addPage,
        removePage: s.removePage,
        setDefaultPage: s.setDefaultPage,
        movePage: s.movePage,
        updatePage: s.updatePage,
      }))
    )

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
      if (!selectedPageId || !pages || pages.length <= 1) return
      removePage(selectedPageId)
    },
    [selectedPageId, pages, removePage, selectedWidgetId]
  )

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [handleKeyDown])

  const handlePageDragStart = useCallback((index: number) => {
    dragFromIndex.current = index
  }, [])
  const handlePageDrop = useCallback(
    (toIndex: number) => {
      if (dragFromIndex.current !== null && dragFromIndex.current !== toIndex) {
        movePage(dragFromIndex.current, toIndex)
      }
      dragFromIndex.current = null
    },
    [movePage]
  )
  const handlePageContextMenu = useCallback((pageId: string, x: number, y: number) => {
    setContextMenu({ pageId, x, y })
  }, [])

  if (!pages || !topBar) {
    return (
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          color: 'hsl(var(--text-dim))',
        }}
      >
        <div style={{ fontSize: 32, opacity: 0.2 }}>◫</div>
        <p style={{ fontSize: 14, color: 'hsl(var(--text))' }}>No config loaded</p>
        <p style={{ fontSize: 11, color: 'hsl(var(--text-muted))', maxWidth: 360, textAlign: 'center' }}>
          Open the ECU Profile route, load a catalogue entry, then return here.
        </p>
      </div>
    )
  }

  const currentPage = pages.find((p) => p.id === selectedPageId) ?? pages[0]

  const handleDuplicate = (pageId: string) => {
    const page = pages.find((p) => p.id === pageId)
    if (!page) return
    const originalIndex = pages.findIndex((p) => p.id === pageId)
    const newPage: PageConfig = {
      ...page,
      id: generateId('page'),
      widgets: page.widgets.map((w) => ({ ...w, id: generateId(w.type) })),
    }
    const originalLength = pages.length
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
          background: 'hsl(var(--surface))',
          borderRight: '1px solid hsl(var(--border))',
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
                color: 'hsl(var(--text-dim))',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
              }}
            >
              Pages
            </span>
            <span
              style={{
                fontSize: 10,
                color:
                  pages.length >= FIRMWARE_CAPS.MAX_PAGES
                    ? 'hsl(var(--destructive))'
                    : 'hsl(var(--text-muted))',
                fontFamily: 'monospace',
              }}
              title={`Firmware accepts at most ${FIRMWARE_CAPS.MAX_PAGES.toString()} pages`}
            >
              {pages.length}/{FIRMWARE_CAPS.MAX_PAGES}
            </span>
          </div>

          {pages.map((page, index) => (
            <PageListItem
              key={page.id}
              page={page}
              index={index}
              isDefault={page.id === defaultPageId}
              isSelected={page.id === (selectedPageId ?? pages[0]?.id)}
              canRemove={pages.length > 1}
              topBar={topBar}
              onSelect={selectPage}
              onDragStart={handlePageDragStart}
              onDrop={handlePageDrop}
              onSetDefault={setDefaultPage}
              onRemove={removePage}
              onContextMenu={handlePageContextMenu}
            />
          ))}

          {(() => {
            const atCap = pages.length >= FIRMWARE_CAPS.MAX_PAGES
            return (
              <Button
                variant="outline"
                size="sm"
                className="w-full mb-2 h-7 text-xs"
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
              >
                + Page
              </Button>
            )
          })()}
        </div>

        <div style={{ height: 1, background: 'hsl(var(--border))', flexShrink: 0 }} />

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
            <Canvas page={currentPage} topBar={topBar} />
          </Suspense>
        </ErrorBoundary>
      ) : (
        <div
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'hsl(var(--text-muted))',
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
          isDefault={contextMenu.pageId === defaultPageId}
          isVisible={pages.find((p) => p.id === contextMenu.pageId)?.visible ?? true}
          canDelete={pages.length > 1}
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
            const page = pages.find((p) => p.id === contextMenu.pageId)
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

export default EditorRoute
