import { useState, useRef, useEffect, useCallback, lazy, Suspense } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { DEFAULT_PAGE_PALETTE, FIRMWARE_CAPS, HexColorSchema } from '@tmbk/canshift-core'
import { useDashboardStore } from '../stores/dashboard.store'
import { PageListItem } from '../components/editor/PageListItem'
import { PageContextMenu } from './PageContextMenu'
import { RightSidebar } from './RightSidebar'
import { ErrorBoundary } from '../components/ErrorBoundary'
import { createId } from '../utils/id'
import { isEditableTarget } from '../utils/is-editable-target'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

const Canvas = lazy(() => import('../components/editor/Canvas'))
const WidgetPalette = lazy(() => import('../components/editor/WidgetPalette'))

const NEW_PAGE_BG = HexColorSchema.parse('#000000')

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

  const { selectPage, addPage, duplicatePage, removePage, setDefaultPage, movePage, updatePage } =
    useDashboardStore(
      useShallow((s) => ({
        selectPage: s.selectPage,
        addPage: s.addPage,
        duplicatePage: s.duplicatePage,
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
  const [pendingDeletePageId, setPendingDeletePageId] = useState<string | null>(null)

  const dragFromIndex = useRef<number | null>(null)

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key !== 'Delete' && e.key !== 'Backspace') return
      if (isEditableTarget(e.target)) return
      if (selectedWidgetId) return
      if (!selectedPageId || !pages || pages.length <= 1) return
      setPendingDeletePageId(selectedPageId)
    },
    [selectedPageId, pages, selectedWidgetId]
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
  const atCap = pages.length >= FIRMWARE_CAPS.MAX_PAGES

  const pendingDeleteIndex = pendingDeletePageId
    ? pages.findIndex((p) => p.id === pendingDeletePageId)
    : -1
  const pendingDeleteLabel = pendingDeleteIndex >= 0 ? `Page ${pendingDeleteIndex + 1}` : 'page'
  const pendingDeleteWidgetCount =
    pendingDeleteIndex >= 0 ? (pages[pendingDeleteIndex]?.widgets.length ?? 0) : 0

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
              onRemove={setPendingDeletePageId}
              onContextMenu={handlePageContextMenu}
            />
          ))}

          <Button
            variant="outline"
            size="sm"
            className="w-full mb-2 h-7 text-xs"
            disabled={atCap}
            onClick={() => {
              if (atCap) return
              addPage({
                id: createId('page'),
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
            duplicatePage(contextMenu.pageId)
          }}
          onSetDefault={() => {
            setDefaultPage(contextMenu.pageId)
          }}
          onToggleVisible={() => {
            const page = pages.find((p) => p.id === contextMenu.pageId)
            if (page) updatePage(contextMenu.pageId, { visible: !page.visible })
          }}
          onDelete={() => {
            setPendingDeletePageId(contextMenu.pageId)
          }}
        />
      )}

      <AlertDialog
        open={pendingDeletePageId !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDeletePageId(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {pendingDeleteLabel}?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the page and its {pendingDeleteWidgetCount} widget
              {pendingDeleteWidgetCount === 1 ? '' : 's'}. You can undo with ⌘Z.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => {
                setPendingDeletePageId(null)
              }}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pendingDeletePageId) removePage(pendingDeletePageId)
                setPendingDeletePageId(null)
              }}
            >
              Delete page
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

export default EditorRoute
