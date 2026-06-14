import { useRef, useCallback, useEffect, useMemo, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
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
import { useDragState } from '../../hooks/useDragState'
import { DEFAULT_PAGE_PALETTE } from '@tmbk/canshift-core'

import { DAY_PALETTE_DEFAULT, DAY_BG_DEFAULT } from '../../constants/theme'

const SCALE = 1.5

const RB_THRESHOLD = 4

const EMPTY_PAGES: readonly PageConfig[] = []

interface CanvasProps {
  page: PageConfig
  topBar: TopBarConfig
}

const Canvas = ({ page, topBar }: CanvasProps) => {
  const targetProfileId = useDashboardStore((s) => s.config?.targetProfile)
  const screenProfile = useMemo(() => resolveScreenProfile(targetProfileId), [targetProfileId])
  const CANVAS_W = screenProfile.width * SCALE
  const CANVAS_H = screenProfile.height * SCALE

  const { selectedWidgetId, selectedWidgetIds } = useDashboardStore(
    useShallow((s) => ({
      selectedWidgetId: s.selectedWidgetId,
      selectedWidgetIds: s.selectedWidgetIds,
    }))
  )

  const {
    selectWidget,
    selectWidgets,
    toggleWidgetSelection,
    removeWidgets,
    copyWidgets,
    pasteWidgets,
    nudgeWidgets,
    selectPage,
  } = useDashboardStore(
    useShallow((s) => ({
      selectWidget: s.selectWidget,
      selectWidgets: s.selectWidgets,
      toggleWidgetSelection: s.toggleWidgetSelection,
      removeWidgets: s.removeWidgets,
      copyWidgets: s.copyWidgets,
      pasteWidgets: s.pasteWidgets,
      nudgeWidgets: s.nudgeWidgets,
      selectPage: s.selectPage,
    }))
  )

  const { dayTheme, nightTheme, pages } = useDashboardStore(
    useShallow((s) => ({
      dayTheme: s.config?.dayTheme,
      nightTheme: s.config?.nightTheme,
      pages: s.config?.pages ?? EMPTY_PAGES,
    }))
  )

  const deviceIsDayMode = useDeviceStore((s) => s.isDayMode)
  const containerRef = useRef<HTMLDivElement>(null)
  const zoomRef = useRef<number>(1)
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

  useEffect(() => {
    if (!revLimiting) {
      setFlashPhase(false)
      return
    }
    const interval = setInterval(() => {
      setFlashPhase((v) => !v)
    }, 80)
    const timeout = setTimeout(() => {
      setRevLimiting(false)
    }, 5000)
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
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
        return

      const { selectedWidgetIds: activeIds } = useDashboardStore.getState()

      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        selectWidget(null)
        return
      }

      const isMod = e.metaKey || e.ctrlKey
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
    const isEditableTarget = (e: Event) => {
      const t = e.target as HTMLElement
      return t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable
    }

    const handleCopy = (e: ClipboardEvent) => {
      if (isEditableTarget(e)) return
      const { selectedWidgetIds: ids, selectedPageId } = useDashboardStore.getState()
      if (ids.length === 0 || !selectedPageId) return
      e.preventDefault()
      copyWidgets(selectedPageId, ids)
    }

    const handleCut = (e: ClipboardEvent) => {
      if (isEditableTarget(e)) return
      const { selectedWidgetIds: ids, selectedPageId } = useDashboardStore.getState()
      if (ids.length === 0 || !selectedPageId) return
      e.preventDefault()
      copyWidgets(selectedPageId, ids)
      removeWidgets(selectedPageId, ids)
    }

    const handlePaste = (e: ClipboardEvent) => {
      if (isEditableTarget(e)) return
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
      const startFwX = (e.clientX - cr.left) / SCALE
      const startFwY = (e.clientY - cr.top) / SCALE
      rubberBandRef.current = { startFwX, startFwY }

      const handleMove = (ev: MouseEvent) => {
        if (!rubberBandRef.current || !containerRef.current) return
        const r = containerRef.current.getBoundingClientRect()
        const curFwX = (ev.clientX - r.left) / SCALE
        const curFwY = (ev.clientY - r.top) / SCALE
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
        const curFwX = (ev.clientX - r.left) / SCALE
        const curFwY = (ev.clientY - r.top) / SCALE
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
    [page.id, selectWidgets]
  )

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        flex: 1,
        overflow: 'hidden',
        background: '#111111',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          padding: '4px 10px',
          borderBottom: '1px solid #1A1A1A',
          gap: 8,
          flexShrink: 0,
          minHeight: 28,
        }}
      >
        {selectedWidgetIds.length >= 2 ? (
          <AlignToolbar
            pageId={page.id}
            widgetIds={selectedWidgetIds}
            canDistribute={selectedWidgetIds.length >= 3}
          />
        ) : (
          <span style={{ fontSize: 9, color: '#333333', letterSpacing: '0.05em' }}>
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

        <button
          onClick={() => {
            setRevLimiting(true)
          }}
          disabled={revLimiting}
          title="Simulate rev limiter (5s)"
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
        </button>
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
                  scale={SCALE}
                  settingsOpen={settingsOpen}
                  isDayMode={activeDayMode}
                  onOpenSettings={() => {
                    setSettingsOpen((o) => !o)
                  }}
                />
              )}

              <div
                ref={containerRef}
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
                    backgroundSize: `${String(40 * SCALE)}px ${String(28 * SCALE)}px`,
                    pointerEvents: 'none',
                  }}
                />

                {(page.template ?? 'custom') === 'cruise_control' ? (
                  <CruiseControlPreview
                    scale={SCALE}
                    canvasW={CANVAS_W}
                    contentH={widgetAreaH * SCALE}
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
                      scale={SCALE}
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
                      left: rubberBand.x * SCALE,
                      top: rubberBand.y * SCALE,
                      width: Math.max(0, rubberBand.w * SCALE),
                      height: Math.max(0, rubberBand.h * SCALE),
                      border: '1px solid #6688FF',
                      background: '#3344FF18',
                      pointerEvents: 'none',
                      zIndex: 100,
                    }}
                  />
                )}

                {settingsOpen && <ScreenSettingsPanel scale={SCALE} />}

                {diagOpen && <DiagnosticsPanel scale={SCALE} />}

                {revLimiting && (
                  <div
                    style={{
                      position: 'absolute',
                      inset: 0,
                      background: flashPhase ? '#FF0000CC' : '#FF000011',
                      transition: 'background 0.04s',
                      pointerEvents: 'none',
                      zIndex: 200,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <svg
                      width={CANVAS_W * 0.28}
                      height={CANVAS_W * 0.28}
                      viewBox="0 0 100 100"
                      style={{ opacity: flashPhase ? 1 : 0.15, transition: 'opacity 0.04s' }}
                    >
                      <polygon
                        points="50,8 96,90 4,90"
                        fill="none"
                        stroke="#FFFFFF"
                        strokeWidth="7"
                        strokeLinejoin="round"
                      />
                      <text
                        x="50"
                        y="80"
                        textAnchor="middle"
                        fill="#FFFFFF"
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
    </div>
  )
}

export default Canvas
