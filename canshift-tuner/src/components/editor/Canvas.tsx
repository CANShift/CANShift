import { useRef, useCallback, useMemo, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import type { PageConfig, PagePalette, TopBarConfig } from '@tmbk/canshift-core'
import {
  LAYOUT_GRID,
  isSpanOverflowing,
  placementsOverlap,
  resolveGridRect,
  resolveScreenProfile,
} from '@tmbk/canshift-core'
import { useDashboardStore } from '../../stores/dashboard.store'
import { useDeviceStore } from '../../stores/device.store'
import ScreenSettingsPanel from './ScreenSettingsPanel'
import DiagnosticsPanel from './DiagnosticsPanel'
import { CruiseControlPreview } from './CruiseControlPreview'
import { WidgetBox } from './WidgetBox'
import { DashTopBar } from './DashTopBar'
import { CanvasToolbar } from './CanvasToolbar'
import { RevLimiterOverlay } from './RevLimiterOverlay'
import { ShortcutsDialog } from './ShortcutsDialog'
import { useDragState } from '../../hooks/useDragState'
import { useCanvasKeyboard } from '../../hooks/useCanvasKeyboard'
import { useClipboardWidgets } from '../../hooks/useClipboardWidgets'
import { useRubberBandSelection } from '../../hooks/useRubberBandSelection'
import { useRevLimiterFlash } from '../../hooks/useRevLimiterFlash'
import { useSwipeGestures } from '../../hooks/useSwipeGestures'
import { DEFAULT_PAGE_PALETTE } from '@tmbk/canshift-core'

import { DAY_PALETTE_DEFAULT, DAY_BG_DEFAULT } from '../../constants/theme'
import { MONO_FONT } from '../../lib/typography'

const SCALE = 1.5
const ZOOM_STEPS = [0.5, 0.75, 1, 1.5, 2] as const

const EMPTY_PAGES: readonly PageConfig[] = []

interface CanvasProps {
  page: PageConfig
  topBar: TopBarConfig
  pageIndex?: number | undefined
  pageStrip?: ReactNode
  inspector?: ReactNode
}

const Canvas = ({ page, topBar, pageIndex, pageStrip, inspector }: CanvasProps) => {
  const targetProfileId = useDashboardStore((s) => s.config?.targetProfile)
  const screenProfile = useMemo(() => resolveScreenProfile(targetProfileId), [targetProfileId])
  const [zoom, setZoom] = useState(1)
  const effScale = SCALE * zoom
  const CANVAS_W = screenProfile.width * effScale
  const CANVAS_H = screenProfile.height * effScale

  const selectedWidgetId = useDashboardStore((s) => s.selectedWidgetId)
  const selectedWidgetIds = useDashboardStore((s) => s.selectedWidgetIds)

  const selectWidget = useDashboardStore((s) => s.selectWidget)
  const selectWidgets = useDashboardStore((s) => s.selectWidgets)
  const toggleWidgetSelection = useDashboardStore((s) => s.toggleWidgetSelection)
  const removeWidgets = useDashboardStore((s) => s.removeWidgets)
  const copyWidgets = useDashboardStore((s) => s.copyWidgets)
  const pasteWidgets = useDashboardStore((s) => s.pasteWidgets)
  const nudgeWidgets = useDashboardStore((s) => s.nudgeWidgets)
  const selectPage = useDashboardStore((s) => s.selectPage)
  const undo = useDashboardStore((s) => s.undo)
  const redo = useDashboardStore((s) => s.redo)
  const canUndo = useDashboardStore((s) => s.past.length > 0)
  const canRedo = useDashboardStore((s) => s.future.length > 0)

  const dayTheme = useDashboardStore((s) => s.config?.dayTheme)
  const nightTheme = useDashboardStore((s) => s.config?.nightTheme)
  const pages = useDashboardStore((s) => s.config?.pages ?? EMPTY_PAGES)

  const deviceIsDayMode = useDeviceStore((s) => s.isDayMode)
  const containerRef = useRef<HTMLDivElement>(null)
  const zoomRef = useRef<number>(1)
  zoomRef.current = zoom

  const widgetAreaH =
    page.showTopBar !== false ? screenProfile.height - topBar.height : screenProfile.height

  const dragInputsRef = useRef({
    pageId: page.id,
    pageWidgets: page.widgets,
    selectedWidgetIds,
    canvasW: screenProfile.width,
    widgetAreaH,
  })
  dragInputsRef.current = {
    pageId: page.id,
    pageWidgets: page.widgets,
    selectedWidgetIds,
    canvasW: screenProfile.width,
    widgetAreaH,
  }

  const kbdRef = useRef({ pageId: page.id, pageWidgets: page.widgets })
  kbdRef.current = { pageId: page.id, pageWidgets: page.widgets }

  const activeDayMode = deviceIsDayMode ?? false

  const effectivePalette: PagePalette = useMemo(
    () =>
      activeDayMode
        ? (dayTheme?.palette ?? DAY_PALETTE_DEFAULT)
        : (nightTheme?.palette ?? page.palette ?? DEFAULT_PAGE_PALETTE),
    [activeDayMode, dayTheme?.palette, nightTheme?.palette, page.palette]
  )
  const effectiveBgColor: string = activeDayMode
    ? (dayTheme?.bgColor ?? DAY_BG_DEFAULT)
    : (nightTheme?.bgColor ?? page.backgroundColor)

  const [settingsOpen, setSettingsOpen] = useState(false)
  const [diagOpen, setDiagOpen] = useState(false)
  const [shortcutsOpen, setShortcutsOpen] = useState(false)

  const { revLimiting, flashPhase, startRevLimiter } = useRevLimiterFlash()

  const stepZoom = useCallback((dir: 1 | -1) => {
    setZoom((z) => {
      const idx = ZOOM_STEPS.indexOf(z as (typeof ZOOM_STEPS)[number])
      const base = idx === -1 ? ZOOM_STEPS.indexOf(1) : idx
      const next = ZOOM_STEPS[Math.max(0, Math.min(ZOOM_STEPS.length - 1, base + dir))]
      return next ?? z
    })
  }, [])

  const overlappingIds = useMemo(() => {
    const ids = new Set<string>()
    const widgets = page.widgets
    for (let i = 0; i < widgets.length; i++) {
      for (let j = i + 1; j < widgets.length; j++) {
        const a = widgets[i]
        const b = widgets[j]
        if (!a || !b) continue
        if (a.type === 'warning' || b.type === 'warning') continue
        if (placementsOverlap(a.layout, b.layout)) {
          ids.add(a.id)
          ids.add(b.id)
        }
      }
    }
    return ids
  }, [page.widgets])

  const overflowingIds = useMemo(() => {
    const ids = new Set<string>()
    for (const w of page.widgets) {
      if (isSpanOverflowing(w.layout)) ids.add(w.id)
    }
    return ids
  }, [page.widgets])

  const gridGuides = useMemo(() => {
    const area = { width: screenProfile.width, height: widgetAreaH }
    const verticals: number[] = []
    for (let c = 0; c < LAYOUT_GRID.COLUMNS; c++) {
      const r = resolveGridRect({ col: c, colSpan: 1, row: 0, rowSpan: 1 }, area)
      verticals.push(r.x, r.x + r.w)
    }
    const horizontals: number[] = []
    for (let r = 0; r < LAYOUT_GRID.ROWS; r++) {
      const rect = resolveGridRect({ col: 0, colSpan: 1, row: r, rowSpan: 1 }, area)
      horizontals.push(rect.y, rect.y + rect.h)
    }
    return { verticals, horizontals }
  }, [screenProfile.width, widgetAreaH])

  useCanvasKeyboard({
    selectWidget,
    selectWidgets,
    removeWidgets,
    nudgeWidgets,
    kbdRef,
    setShortcutsOpen,
  })

  useClipboardWidgets({ copyWidgets, removeWidgets, pasteWidgets })

  const handleDragStart = useDragState({ dragInputsRef, zoomRef, scale: SCALE })

  const { rubberBand, startRubberBand } = useRubberBandSelection({
    containerRef,
    effScale,
    pageId: page.id,
    selectWidgets,
  })

  const { onPointerDown, onPointerUp } = useSwipeGestures({
    containerRef,
    pageId: page.id,
    pages,
    rubberBand,
    diagOpen,
    settingsOpen,
    setDiagOpen,
    selectWidget,
    selectPage,
    startRubberBand,
  })

  const selectedWidget =
    selectedWidgetId !== null ? page.widgets.find((w) => w.id === selectedWidgetId) : undefined
  const selectedRect = selectedWidget
    ? resolveGridRect(selectedWidget.layout, {
        width: screenProfile.width,
        height: widgetAreaH,
      })
    : null

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        flex: 1,
        overflow: 'hidden',
      }}
    >
      <CanvasToolbar
        pageId={page.id}
        selectedWidgetIds={selectedWidgetIds}
        screenWidth={screenProfile.width}
        screenHeight={screenProfile.height}
        overflowingCount={overflowingIds.size}
        canUndo={canUndo}
        canRedo={canRedo}
        onUndo={undo}
        onRedo={redo}
        zoom={zoom}
        onZoomIn={() => {
          stepZoom(1)
        }}
        onZoomOut={() => {
          stepZoom(-1)
        }}
        onZoomReset={() => {
          setZoom(1)
        }}
        onOpenShortcuts={() => {
          setShortcutsOpen(true)
        }}
        revLimiting={revLimiting}
        onStartRevLimiter={startRevLimiter}
      />

      {pageStrip}

      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
          <div
            onMouseDown={(e) => {
              const target = e.target as HTMLElement
              if (target.closest('[data-widget]') === null) selectWidget(null)
            }}
            style={canvasZoneStyle}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={canvasTitleRowStyle}>
                <span style={canvasTitleStyle}>
                  {pageIndex !== undefined ? `PAGE ${String(pageIndex + 1)}` : 'PAGE'}
                </span>
                <span style={canvasDimsStyle}>
                  {screenProfile.width} × {screenProfile.height} @ {SCALE * zoom}×
                </span>
              </div>
              <div style={deviceFrameStyle}>
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    width: CANVAS_W,
                    height: CANVAS_H,
                    background: effectiveBgColor,
                    overflow: 'hidden',
                  }}
                >
                  {page.showTopBar !== false && (
                    <DashTopBar
                      topBar={topBar}
                      scale={effScale}
                      settingsOpen={settingsOpen}
                      isDayMode={activeDayMode}
                      onOpenSettings={() => {
                        setSettingsOpen((o) => !o)
                      }}
                    />
                  )}

                  <div
                    ref={containerRef}
                    onWheel={(e) => {
                      if (!e.metaKey && !e.ctrlKey) return
                      e.preventDefault()
                      stepZoom(e.deltaY < 0 ? 1 : -1)
                    }}
                    onPointerDown={onPointerDown}
                    onPointerUp={onPointerUp}
                    style={{
                      position: 'relative',
                      flex: 1,
                      overflow: 'hidden',
                      cursor: 'default',
                    }}
                  >
                    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
                      {gridGuides.verticals.map((x, i) => (
                        <div
                          key={`v${String(i)}`}
                          style={{
                            position: 'absolute',
                            top: 0,
                            bottom: 0,
                            left: x * effScale,
                            width: 1,
                            background: '#FFFFFF0A',
                          }}
                        />
                      ))}
                      {gridGuides.horizontals.map((y, i) => (
                        <div
                          key={`h${String(i)}`}
                          style={{
                            position: 'absolute',
                            left: 0,
                            right: 0,
                            top: y * effScale,
                            height: 1,
                            background: '#FFFFFF0A',
                          }}
                        />
                      ))}
                    </div>

                    {(page.template ?? 'custom') === 'cruise_control' ? (
                      <CruiseControlPreview
                        scale={effScale}
                        canvasW={CANVAS_W}
                        contentH={widgetAreaH * effScale}
                        palette={effectivePalette}
                      />
                    ) : (
                      [
                        ...page.widgets.filter((w) => w.type !== 'warning'),
                        ...page.widgets.filter((w) => w.type === 'warning'),
                      ].map((widget) => (
                        <WidgetBox
                          key={widget.id}
                          widget={widget}
                          palette={effectivePalette}
                          scale={effScale}
                          areaWidth={screenProfile.width}
                          areaHeight={widgetAreaH}
                          isSelected={widget.id === selectedWidgetId}
                          isInMultiSelection={
                            selectedWidgetIds.length > 1 && selectedWidgetIds.includes(widget.id)
                          }
                          isOverlapping={overlappingIds.has(widget.id)}
                          isOverflowing={overflowingIds.has(widget.id)}
                          revLimiting={revLimiting}
                          onSelect={selectWidget}
                          onShiftSelect={toggleWidgetSelection}
                          onDragStart={handleDragStart}
                        />
                      ))
                    )}

                    {rubberBand && (
                      <div
                        style={{
                          position: 'absolute',
                          left: rubberBand.x * effScale,
                          top: rubberBand.y * effScale,
                          width: Math.max(0, rubberBand.w * effScale),
                          height: Math.max(0, rubberBand.h * effScale),
                          border: '1px solid #6688FF',
                          background: '#3344FF18',
                          pointerEvents: 'none',
                          zIndex: 100,
                        }}
                      />
                    )}

                    {settingsOpen && <ScreenSettingsPanel scale={effScale} />}

                    {diagOpen && <DiagnosticsPanel scale={effScale} />}

                    {revLimiting && (
                      <RevLimiterOverlay canvasW={CANVAS_W} flashPhase={flashPhase} scale={SCALE} />
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div style={statusBarStyle}>
            {selectedWidget && selectedRect ? (
              <>
                <span>
                  SELECTED{' '}
                  <span style={statusValueStyle}>
                    {selectedWidget.type}
                    {selectedWidget.signal ? `.${selectedWidget.signal}` : ''}
                  </span>
                </span>
                <span>
                  col {selectedWidget.layout.col} · span {selectedWidget.layout.colSpan}
                </span>
                <span>
                  row {selectedWidget.layout.row} · span {selectedWidget.layout.rowSpan}
                </span>
                <span>
                  x {selectedRect.x} · y {selectedRect.y} · w {selectedRect.w} · h {selectedRect.h}
                </span>
              </>
            ) : (
              <span>
                {String(page.widgets.length)} widget{page.widgets.length === 1 ? '' : 's'} — click
                one to inspect
              </span>
            )}
            <span style={{ marginLeft: 'auto' }}>
              {page.showTopBar !== false ? 'top bar shown' : 'top bar hidden'}
            </span>
          </div>
        </div>

        {inspector}
      </div>

      <ShortcutsDialog open={shortcutsOpen} onOpenChange={setShortcutsOpen} />
    </div>
  )
}

const canvasZoneStyle: CSSProperties = {
  flex: 1,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  overflow: 'auto',
  backgroundColor: 'hsl(var(--brand-neutral-100))',
  backgroundImage:
    'linear-gradient(hsl(var(--brand-neutral-200)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--brand-neutral-200)) 1px, transparent 1px)',
  backgroundSize: '24px 24px',
}

const canvasTitleRowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'baseline',
  gap: 10,
}

const canvasTitleStyle: CSSProperties = {
  fontWeight: 800,
  fontSize: 10,
  letterSpacing: '0.2em',
  color: 'hsl(var(--brand-neutral-600))',
}

const canvasDimsStyle: CSSProperties = {
  fontFamily: MONO_FONT,
  fontSize: 11,
  color: 'hsl(var(--brand-neutral-600))',
}

const deviceFrameStyle: CSSProperties = {
  border: '2px solid hsl(var(--brand-neutral-400))',
}

const statusBarStyle: CSSProperties = {
  height: 36,
  flexShrink: 0,
  borderTop: '2px solid var(--brand-divider)',
  display: 'flex',
  alignItems: 'center',
  gap: 22,
  padding: '0 20px',
  fontFamily: MONO_FONT,
  fontSize: 11,
  color: 'hsl(var(--brand-neutral-600))',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
}

const statusValueStyle: CSSProperties = {
  color: 'hsl(var(--brand-text))',
}

export default Canvas
