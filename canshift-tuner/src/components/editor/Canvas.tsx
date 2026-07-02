import { Fragment, useRef, useCallback, useEffect, useMemo, useState } from 'react'
import type { PageConfig, PagePalette, TopBarConfig } from '@tmbk/canshift-core'
import { resolveScreenProfile } from '@tmbk/canshift-core'
import { useDashboardStore } from '../../stores/dashboard.store'
import { useDeviceStore } from '../../stores/device.store'
import ScreenSettingsPanel from './ScreenSettingsPanel'
import DiagnosticsPanel from './DiagnosticsPanel'
import { CruiseControlPreview } from './CruiseControlPreview'
import { WidgetBox } from './WidgetBox'
import { AlignToolbar } from './AlignToolbar'
import { DashTopBar } from './DashTopBar'
import { rectsOverlap } from '../../utils/layout'
import { isEditableTarget } from '../../utils/is-editable-target'
import { useDragState } from '../../hooks/useDragState'
import { DEFAULT_PAGE_PALETTE } from '@tmbk/canshift-core'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

import { DAY_PALETTE_DEFAULT, DAY_BG_DEFAULT } from '../../constants/theme'

const SCALE = 1.5
const ZOOM_STEPS = [0.5, 0.75, 1, 1.5, 2] as const
const ZOOM_MIN = 0.5
const ZOOM_MAX = 2

const SHORTCUTS: readonly (readonly [string, string])[] = [
  ['Del / ⌫', 'Delete selected widgets'],
  ['↑ ↓ ← →', 'Nudge 1px (Shift: 10px)'],
  ['⌘A', 'Select all'],
  ['⌘C / ⌘X / ⌘V', 'Copy / cut / paste'],
  ['⌘Z / ⇧⌘Z', 'Undo / redo'],
  ['⌘S', 'Burn to device'],
  ['Alt-drag', 'Disable snap (1px)'],
  ['⌘-scroll', 'Zoom'],
  ['Esc', 'Deselect / close'],
  ['?', 'This help'],
]

const RB_THRESHOLD = 4

const REV_LIMIT_FLASH_HZ = 3
const REV_LIMIT_FLASH_HALF_PERIOD_MS = Math.round(1000 / (REV_LIMIT_FLASH_HZ * 2))
const REV_LIMIT_BORDER_PX = 8
const REV_LIMIT_PREVIEW_MS = 5000

const EMPTY_PAGES: readonly PageConfig[] = []

interface CanvasProps {
  page: PageConfig
  topBar: TopBarConfig
}

const Canvas = ({ page, topBar }: CanvasProps) => {
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
  const swipeRef = useRef<{ startX: number; startY: number } | null>(null)
  const rubberBandRef = useRef<{ startFwX: number; startFwY: number } | null>(null)
  const [rubberBand, setRubberBand] = useState<{
    x: number
    y: number
    w: number
    h: number
  } | null>(null)

  const widgetAreaH = screenProfile.height - topBar.height

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
  const [revLimiting, setRevLimiting] = useState(false)
  const [flashPhase, setFlashPhase] = useState(false)
  const [shortcutsOpen, setShortcutsOpen] = useState(false)

  const stepZoom = useCallback((dir: 1 | -1) => {
    setZoom((z) => {
      const idx = ZOOM_STEPS.indexOf(z as (typeof ZOOM_STEPS)[number])
      const base = idx === -1 ? ZOOM_STEPS.indexOf(1) : idx
      const next = ZOOM_STEPS[Math.max(0, Math.min(ZOOM_STEPS.length - 1, base + dir))]
      return next ?? z
    })
  }, [])

  useEffect(() => {
    if (!revLimiting) {
      setFlashPhase(false)
      return
    }
    const interval = setInterval(() => {
      setFlashPhase((v) => !v)
    }, REV_LIMIT_FLASH_HALF_PERIOD_MS)
    const timeout = setTimeout(() => {
      setRevLimiting(false)
    }, REV_LIMIT_PREVIEW_MS)
    return () => {
      clearInterval(interval)
      clearTimeout(timeout)
    }
  }, [revLimiting])

  const overlappingIds = useMemo(() => {
    const ids = new Set<string>()
    const rects = page.widgets.map((w) => ({
      id: w.id,
      x: w.layout.x,
      y: w.layout.y,
      w: w.layout.w,
      h: w.layout.h,
    }))
    for (let i = 0; i < rects.length; i++) {
      for (let j = i + 1; j < rects.length; j++) {
        const a = rects[i]
        const b = rects[j]
        if (!a || !b) continue
        const wa = page.widgets[i]
        const wb = page.widgets[j]
        if (wa?.type === 'warning' || wb?.type === 'warning') continue
        if (rectsOverlap(a, b)) {
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
      const right = w.layout.x + w.layout.w
      const bottom = w.layout.y + w.layout.h
      if (right > screenProfile.width || bottom > widgetAreaH) {
        ids.add(w.id)
      }
    }
    return ids
  }, [page.widgets, screenProfile.width, widgetAreaH])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isEditableTarget(e.target)) return

      const { selectedWidgetIds: activeIds } = useDashboardStore.getState()

      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        setShortcutsOpen(false)
        selectWidget(null)
        return
      }

      if (e.key === '?') {
        e.preventDefault()
        e.stopPropagation()
        setShortcutsOpen((o) => !o)
        return
      }

      const isMod = e.metaKey || e.ctrlKey
      if (isMod && (e.key.toLowerCase() === 'z' || e.key.toLowerCase() === 'y')) {
        e.preventDefault()
        e.stopPropagation()
        const { undo: doUndo, redo: doRedo } = useDashboardStore.getState()
        if (e.key.toLowerCase() === 'y' || e.shiftKey) doRedo()
        else doUndo()
        return
      }

      if (isMod && e.key === 'a') {
        e.preventDefault()
        e.stopPropagation()
        const allIds = kbdRef.current.pageWidgets.map((w) => w.id)
        if (allIds.length > 0) selectWidgets(allIds)
        return
      }

      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (activeIds.length === 0) return
        e.preventDefault()
        e.stopPropagation()
        removeWidgets(kbdRef.current.pageId, activeIds)
        return
      }

      if (
        activeIds.length > 0 &&
        (e.key === 'ArrowLeft' ||
          e.key === 'ArrowRight' ||
          e.key === 'ArrowUp' ||
          e.key === 'ArrowDown')
      ) {
        e.preventDefault()
        e.stopPropagation()
        const step = e.shiftKey ? 10 : 1
        const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0
        const dy = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0
        nudgeWidgets(kbdRef.current.pageId, activeIds, dx, dy)
        return
      }
    }

    window.addEventListener('keydown', handleKeyDown, { capture: true })
    return () => {
      window.removeEventListener('keydown', handleKeyDown, { capture: true })
    }
  }, [selectWidget, selectWidgets, removeWidgets, nudgeWidgets])

  useEffect(() => {
    const handleCopy = (e: ClipboardEvent) => {
      if (isEditableTarget(e.target)) return
      const { selectedWidgetIds: ids, selectedPageId } = useDashboardStore.getState()
      if (ids.length === 0 || !selectedPageId) return
      e.preventDefault()
      copyWidgets(selectedPageId, ids)
    }

    const handleCut = (e: ClipboardEvent) => {
      if (isEditableTarget(e.target)) return
      const { selectedWidgetIds: ids, selectedPageId } = useDashboardStore.getState()
      if (ids.length === 0 || !selectedPageId) return
      e.preventDefault()
      copyWidgets(selectedPageId, ids)
      removeWidgets(selectedPageId, ids)
    }

    const handlePaste = (e: ClipboardEvent) => {
      if (isEditableTarget(e.target)) return
      const { clipboardWidgets, selectedPageId } = useDashboardStore.getState()
      if (clipboardWidgets.length === 0 || !selectedPageId) return
      e.preventDefault()
      pasteWidgets(selectedPageId)
    }

    document.addEventListener('copy', handleCopy)
    document.addEventListener('cut', handleCut)
    document.addEventListener('paste', handlePaste)
    return () => {
      document.removeEventListener('copy', handleCopy)
      document.removeEventListener('cut', handleCut)
      document.removeEventListener('paste', handlePaste)
    }
  }, [copyWidgets, removeWidgets, pasteWidgets])

  const handleDragStart = useDragState({ dragInputsRef, zoomRef, scale: SCALE })

  const startRubberBand = useCallback(
    (e: React.PointerEvent) => {
      if (!containerRef.current) return
      const cr = containerRef.current.getBoundingClientRect()
      const startFwX = (e.clientX - cr.left) / effScale
      const startFwY = (e.clientY - cr.top) / effScale
      rubberBandRef.current = { startFwX, startFwY }

      const handleMove = (ev: MouseEvent) => {
        if (!rubberBandRef.current || !containerRef.current) return
        const r = containerRef.current.getBoundingClientRect()
        const curFwX = (ev.clientX - r.left) / effScale
        const curFwY = (ev.clientY - r.top) / effScale
        const { startFwX: sx, startFwY: sy } = rubberBandRef.current
        setRubberBand({
          x: Math.min(sx, curFwX),
          y: Math.min(sy, curFwY),
          w: Math.abs(curFwX - sx),
          h: Math.abs(curFwY - sy),
        })
      }

      const capturedPageId = page.id

      const handleUp = (ev: MouseEvent) => {
        document.removeEventListener('mousemove', handleMove)
        document.removeEventListener('mouseup', handleUp)

        if (!rubberBandRef.current || !containerRef.current) {
          rubberBandRef.current = null
          setRubberBand(null)
          return
        }

        const r = containerRef.current.getBoundingClientRect()
        const curFwX = (ev.clientX - r.left) / effScale
        const curFwY = (ev.clientY - r.top) / effScale
        const { startFwX: sx, startFwY: sy } = rubberBandRef.current
        const rbX = Math.min(sx, curFwX)
        const rbY = Math.min(sy, curFwY)
        const rbW = Math.abs(curFwX - sx)
        const rbH = Math.abs(curFwY - sy)

        rubberBandRef.current = null
        setRubberBand(null)

        if (rbW > RB_THRESHOLD || rbH > RB_THRESHOLD) {
          const widgets =
            useDashboardStore.getState().config?.pages.find((p) => p.id === capturedPageId)
              ?.widgets ?? []
          const rb = { id: '', x: rbX, y: rbY, w: rbW, h: rbH }
          const ids = widgets
            .filter((w) =>
              rectsOverlap(rb, {
                id: '',
                x: w.layout.x,
                y: w.layout.y,
                w: w.layout.w,
                h: w.layout.h,
              })
            )
            .map((w) => w.id)
          if (ids.length > 0) selectWidgets(ids)
        }
      }

      document.addEventListener('mousemove', handleMove)
      document.addEventListener('mouseup', handleUp)
    },
    [page.id, selectWidgets, effScale]
  )

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        flex: 1,
        overflow: 'hidden',
        background: 'hsl(var(--bg))',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          padding: '4px 10px',
          borderBottom: '1px solid hsl(var(--surface))',
          gap: 8,
          flexShrink: 0,
          minHeight: 28,
        }}
      >
        <Button
          variant="outline"
          onClick={undo}
          disabled={!canUndo}
          title="Undo (⌘Z)"
          className="h-auto disabled:opacity-100"
          style={{
            padding: '2px 8px',
            fontSize: 12,
            background: 'transparent',
            border: '1px solid hsl(var(--border))',
            borderRadius: 3,
            color: canUndo ? '#AAAAAA' : '#444444',
            cursor: canUndo ? 'pointer' : 'default',
          }}
        >
          ↶
        </Button>
        <Button
          variant="outline"
          onClick={redo}
          disabled={!canRedo}
          title="Redo (⇧⌘Z)"
          className="h-auto disabled:opacity-100"
          style={{
            padding: '2px 8px',
            fontSize: 12,
            background: 'transparent',
            border: '1px solid hsl(var(--border))',
            borderRadius: 3,
            color: canRedo ? '#AAAAAA' : '#444444',
            cursor: canRedo ? 'pointer' : 'default',
          }}
        >
          ↷
        </Button>

        {selectedWidgetIds.length >= 2 ? (
          <AlignToolbar
            pageId={page.id}
            widgetIds={selectedWidgetIds}
            canDistribute={selectedWidgetIds.length >= 3}
          />
        ) : (
          <span style={{ fontSize: 9, color: 'hsl(var(--border))', letterSpacing: '0.05em' }}>
            PREVIEW — {screenProfile.width} × {screenProfile.height}
          </span>
        )}

        {overflowingIds.size > 0 && (
          <span
            title="One or more widgets extend past the target screen bounds. Resize or move them to fit."
            style={{
              padding: '2px 6px',
              fontSize: 9,
              fontWeight: 600,
              background: '#2A1A00',
              border: '1px solid #663300',
              borderRadius: 3,
              color: '#FFAA44',
              letterSpacing: '0.05em',
            }}
          >
            ⚠ {String(overflowingIds.size)} OFF-CANVAS
          </span>
        )}

        <div style={{ flex: 1 }} />

        {selectedWidgetIds.length >= 2 && (
          <span style={{ fontSize: 9, color: '#666666', letterSpacing: '0.04em' }}>
            {String(selectedWidgetIds.length)} selected
          </span>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Button
            variant="outline"
            onClick={() => {
              stepZoom(-1)
            }}
            disabled={zoom <= ZOOM_MIN}
            title="Zoom out"
            className="h-auto disabled:opacity-100"
            style={{ padding: '2px 8px', fontSize: 12, background: 'transparent' }}
          >
            −
          </Button>
          <button
            onClick={() => {
              setZoom(1)
            }}
            title="Reset zoom"
            style={{
              minWidth: 44,
              padding: '2px 4px',
              fontSize: 10,
              fontVariantNumeric: 'tabular-nums',
              background: 'transparent',
              border: 'none',
              color: 'hsl(var(--text-muted))',
              cursor: 'pointer',
            }}
          >
            {Math.round(zoom * 100)}%
          </button>
          <Button
            variant="outline"
            onClick={() => {
              stepZoom(1)
            }}
            disabled={zoom >= ZOOM_MAX}
            title="Zoom in"
            className="h-auto disabled:opacity-100"
            style={{ padding: '2px 8px', fontSize: 12, background: 'transparent' }}
          >
            +
          </Button>
        </div>

        <Button
          variant="outline"
          onClick={() => {
            setShortcutsOpen(true)
          }}
          title="Keyboard shortcuts (?)"
          className="h-auto"
          style={{ padding: '2px 8px', fontSize: 12, background: 'transparent' }}
        >
          ?
        </Button>

        <Button
          variant="outline"
          onClick={() => {
            setRevLimiting(true)
          }}
          disabled={revLimiting}
          title="Simulate rev limiter (5s)"
          className="h-auto disabled:opacity-100"
          style={{
            padding: '3px 10px',
            fontSize: 10,
            fontWeight: 600,
            background: revLimiting ? '#3A0000' : '#1E0A0A',
            border: `1px solid ${revLimiting ? '#CC0000' : '#663333'}`,
            borderRadius: 3,
            color: revLimiting ? '#FF4444' : '#CC5555',
            cursor: revLimiting ? 'default' : 'pointer',
            letterSpacing: '0.05em',
          }}
        >
          ⚡ Rev Limit
        </Button>
      </div>

      <div
        onMouseDown={(e) => {
          const target = e.target as HTMLElement
          if (target.closest('[data-widget]') === null) selectWidget(null)
        }}
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'auto',
        }}
      >
        <div>
          <div
            style={{
              background: '#000000',
              border: '3px solid #2A2A2A',
              borderRadius: 6,
              padding: 6,
              boxShadow: '0 8px 32px #00000088',
            }}
          >
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
              {page.showTopBar && (
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
                onPointerDown={(e) => {
                  const target = e.target as HTMLElement
                  const isBackground =
                    target === containerRef.current || target.closest('[data-widget]') === null
                  if (!isBackground) return
                  swipeRef.current = { startX: e.clientX, startY: e.clientY }
                  selectWidget(null)
                  startRubberBand(e)
                }}
                onPointerUp={(e) => {
                  if (rubberBand && (rubberBand.w > RB_THRESHOLD || rubberBand.h > RB_THRESHOLD)) {
                    swipeRef.current = null
                    return
                  }
                  if (!swipeRef.current) return
                  const dx = e.clientX - swipeRef.current.startX
                  const dy = e.clientY - swipeRef.current.startY
                  swipeRef.current = null

                  if (Math.abs(dy) > 28) {
                    if (dy < 0 && !diagOpen && !settingsOpen) setDiagOpen(true)
                    if (dy > 0 && diagOpen) setDiagOpen(false)
                    return
                  }

                  if (diagOpen || settingsOpen) return
                  if (Math.abs(dy) > 20 || Math.abs(dx) < 40) return
                  const currentIdx = pages.findIndex((p) => p.id === page.id)
                  const nextIdx = dx < 0 ? currentIdx + 1 : currentIdx - 1
                  const nextPage = pages[nextIdx]
                  if (nextPage) selectPage(nextPage.id)
                }}
                style={{
                  position: 'relative',
                  flex: 1,
                  overflow: 'hidden',
                  cursor: 'default',
                }}
              >
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    backgroundImage: `
                  linear-gradient(to right, #FFFFFF08 1px, transparent 1px),
                  linear-gradient(to bottom, #FFFFFF08 1px, transparent 1px)
                `,
                    backgroundSize: `${String(40 * effScale)}px ${String(28 * effScale)}px`,
                    pointerEvents: 'none',
                  }}
                />

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
                  <div
                    style={{
                      position: 'absolute',
                      inset: 0,
                      border: `${Math.round(REV_LIMIT_BORDER_PX * SCALE)}px solid #FF0000`,
                      opacity: flashPhase ? 1 : 0.5,
                      transition: 'opacity 0.1s',
                      pointerEvents: 'none',
                      zIndex: 200,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <svg width={CANVAS_W * 0.28} height={CANVAS_W * 0.28} viewBox="0 0 100 100">
                      <polygon
                        points="50,8 96,90 4,90"
                        fill="none"
                        stroke="#FF4444"
                        strokeWidth="7"
                        strokeLinejoin="round"
                      />
                      <text
                        x="50"
                        y="80"
                        textAnchor="middle"
                        fill="#FF4444"
                        fontSize="52"
                        fontWeight="900"
                        fontFamily="monospace"
                      >
                        !
                      </text>
                    </svg>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <AlertDialog open={shortcutsOpen} onOpenChange={setShortcutsOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Keyboard shortcuts</AlertDialogTitle>
          </AlertDialogHeader>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'auto 1fr',
              gap: '6px 16px',
              fontSize: 13,
            }}
          >
            {SHORTCUTS.map(([keys, desc]) => (
              <Fragment key={keys}>
                <kbd style={{ fontFamily: 'monospace', color: 'hsl(var(--text))' }}>{keys}</kbd>
                <span style={{ color: 'hsl(var(--text-muted))' }}>{desc}</span>
              </Fragment>
            ))}
          </div>
          <AlertDialogFooter>
            <AlertDialogAction
              onClick={() => {
                setShortcutsOpen(false)
              }}
            >
              Close
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

export default Canvas
