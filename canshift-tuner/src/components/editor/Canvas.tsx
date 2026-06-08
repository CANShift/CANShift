// Canvas.tsx — 320×240 widget layout editor.
// Supports click/Shift+click selection, rubber-band multi-select, drag-to-move,
// alignment tools, and swipe gestures for page navigation.

import { useRef, useCallback, useEffect, useMemo, useState } from 'react'
import type { PageConfig, PagePalette, TopBarConfig, Widget } from '@tmbk/canshift-core'
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

// ---------------------------------------------------------------------------
// Canvas layout constants
// ---------------------------------------------------------------------------

// Display scale factor: the firmware renders at the target screen profile's
// native dimensions (today: 320×240); we show it at 1.5× for readability. All
// firmware-pixel values are multiplied by SCALE before rendering. The canvas
// pixel dimensions are derived from the active dashboard's `targetProfile`
// (issue #548) rather than hard-coded, so adding a new profile to the catalog
// (#17 / #18) will reshape the preview automatically.
const SCALE = 1.5

// Minimum rubber-band drag distance (firmware px) before activating selection
const RB_THRESHOLD = 4

// Module-level empty fallback for the `pages` selector — keeps the selector
// reference-stable while `config === null` (loading), so unrelated store
// updates don't re-render every Canvas consumer (R-4).
const EMPTY_PAGES: readonly PageConfig[] = []

// ---------------------------------------------------------------------------
// Canvas
// ---------------------------------------------------------------------------

interface CanvasProps {
  page: PageConfig
  topBar: TopBarConfig
}

export default function Canvas({ page, topBar }: CanvasProps) {
  // Pull the target screen profile id from the active dashboard; falls back
  // to the default profile (`crowpanel-28`, 320×240) when the field is
  // missing on legacy configs (issue #548).
  const targetProfileId = useDashboardStore((s) => s.config?.targetProfile)
  const screenProfile = useMemo(() => resolveScreenProfile(targetProfileId), [targetProfileId])
  const CANVAS_W = screenProfile.width * SCALE
  const CANVAS_H = screenProfile.height * SCALE
  const selectedWidgetId = useDashboardStore((s) => s.selectedWidgetId)
  const selectedWidgetIds = useDashboardStore((s) => s.selectedWidgetIds)
  const selectWidget = useDashboardStore((s) => s.selectWidget)
  const selectWidgets = useDashboardStore((s) => s.selectWidgets)
  const toggleWidgetSelection = useDashboardStore((s) => s.toggleWidgetSelection)
  const removeWidgets = useDashboardStore((s) => s.removeWidgets)
  const copyWidgets = useDashboardStore((s) => s.copyWidgets)
  const pasteWidgets = useDashboardStore((s) => s.pasteWidgets)
  const nudgeWidgets = useDashboardStore((s) => s.nudgeWidgets)
  const deviceIsDayMode = useDeviceStore((s) => s.isDayMode)
  const dayTheme = useDashboardStore((s) => s.config?.dayTheme)
  const nightTheme = useDashboardStore((s) => s.config?.nightTheme)
  const pages = useDashboardStore((s) => s.config?.pages ?? EMPTY_PAGES)
  const selectPage = useDashboardStore((s) => s.selectPage)
  const containerRef = useRef<HTMLDivElement>(null)
  const zoomRef = useRef<number>(1)
  // Swipe left/right tracking (page navigation)
  const swipeRef = useRef<{ startX: number; startY: number } | null>(null)
  // Rubber-band selection
  const rubberBandRef = useRef<{ startFwX: number; startFwY: number } | null>(null)
  const [rubberBand, setRubberBand] = useState<{
    x: number
    y: number
    w: number
    h: number
  } | null>(null)

  // Widget area height is the canvas height minus the top bar. The canvas
  // height comes from the active target screen profile (issue #548) so the
  // bounds shrink/expand as the user picks a different panel.
  const widgetAreaH = screenProfile.height - topBar.height

  // Ref-based snapshot of values consumed inside drag callbacks. Keeps the
  // memoized handlers (handleDragStart, selection helpers) ref-stable across
  // renders so per-widget React.memo on WidgetBox is not invalidated every
  // drag tick. The drag handler reads from .current at mousedown time.
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

  // Ref-based snapshot for the keyboard handler — lets the effect avoid
  // re-registering on every drag tick (page.widgets changes at 60fps during
  // drag, which would thrash the event listener). Reads from .current inside.
  const kbdRef = useRef({ pageId: page.id, pageWidgets: page.widgets })
  kbdRef.current = { pageId: page.id, pageWidgets: page.widgets }

  // When a device is connected it reports its own isDayMode; otherwise default
  // to night (dark) — the day/night toggle was removed from the editor chrome
  // because the theme picker / day theme editor are no longer surfaced.
  const activeDayMode = deviceIsDayMode ?? false

  // Effective palette and background — follow the active day/night mode.
  // Day picks `dayTheme`, night picks `nightTheme` when set, otherwise falls
  // back to the page-level palette / backgroundColor (pre-#21 v2 behaviour).
  // Memoized so the reference stays stable across drag ticks (otherwise every
  // mouse move would invalidate the WidgetPreview React.memo cache via a new
  // palette object literal even though contents are unchanged).
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

  // Rev limit flash: alternates red overlay every 80ms, auto-stops after 5s
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

  // Compute which widget ids currently overlap — shown with red border as
  // feedback. Memoized on `page.widgets` so the O(n²) pair scan doesn't rerun
  // on every render (Canvas rerenders at 60 fps during multi-widget drag —
  // see `moveWidgets` in dashboard.store.ts which intentionally bypasses
  // history for the drag path). Immer keeps `page.widgets` referentially
  // stable across unrelated store updates, so unrelated rerenders are
  // deduped too. Mirrors the `overflowingIds` block below.
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

  // Compute which widget ids extend past the active screen profile bounds —
  // warn, do NOT auto-clamp (issue #548). A dashboard authored on a 320×240
  // profile and re-opened against a smaller catalog entry will surface every
  // off-canvas widget so the author can fix the layout manually.
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

  // Keyboard handler — registered in the CAPTURE phase so it fires before the
  // EditorRoute bubble handler (which deletes pages on Delete/Backspace without
  // checking for widget selection). When we handle an event, stopPropagation
  // prevents EditorRoute from also responding.
  //
  // Cmd+C/X/V are NOT handled here — the Electron menu's role:'copy/cut/paste'
  // intercepts those at the main-process level. They are handled via the
  // document 'copy'/'cut'/'paste' events below, which DO fire even with roles.
  //
  // Cmd+D is handled by the Electron menu → IPC → useMenuEvents (already works).
  //
  // Reads selection from `useDashboardStore.getState()` inside the listener so
  // the effect depends only on stable zustand action setters. Re-registering
  // on every selection change opened a microtask window where a queued keydown
  // hit the EditorRoute bubble handler instead — which deleted the current
  // page (R-6).
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
        if (activeIds.length === 0) return // no widget selected — let EditorRoute handle page deletion
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

  // Clipboard: copy/cut/paste events fire even when the Electron menu role
  // intercepts the accelerator. Read fresh state via getState() so these
  // handlers never go stale and don't need to re-register on selection changes.
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

  // Rubber-band: starts on background mousedown, selects widgets on mouseup.
  // Snapshot `pageId` at pointerDown and resolve widgets fresh on mouseup from
  // the store — surviving a mid-drag page swipe without selecting ids that
  // belong to the previous page (R-2).
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

      // Snapshot the active page id at drag-start. On mouseup we look it up
      // again on the live store so the widget list reflects any deletions /
      // edits that happened mid-drag, while still binding to the page the
      // gesture started on.
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
          // Select all widgets that intersect the rubber-band rect
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
          // else: already deselected on pointerDown
        }
        // Small movement → treat as tap (already deselected on pointerDown), no-op here
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
      {/* Studio toolbar */}
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
        {/* Alignment tools — shown when 2+ widgets selected */}
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

        {/* Overflow indicator — surfaces target-profile bounds violations
            (issue #548) without auto-clamping the layout. Hidden when no widget
            extends past the canvas. */}
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

        {/* Multi-selection badge */}
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

      {/* Canvas area — scrollable if window is smaller than 320×240 */}
      <div
        onMouseDown={(e) => {
          // Deselect when clicking outside any widget (canvas surround, border, etc.)
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
        {/* 1:1 frame — no transform scaling */}
        <div>
          {/* Physical screen border */}
          <div
            style={{
              background: '#000000',
              border: '3px solid #2A2A2A',
              borderRadius: 6,
              padding: 6,
              boxShadow: '0 8px 32px #00000088',
            }}
          >
            {/* The 320×240 canvas — 1:1 firmware pixels, visually scaled by zoom */}
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
              {/* Dashboard top bar — fixed height, pushes widget area down */}
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

              {/* Widget area — coordinate origin (0,0) is below the top bar */}
              <div
                ref={containerRef}
                onPointerDown={(e) => {
                  const target = e.target as HTMLElement
                  const isBackground =
                    target === containerRef.current || target.closest('[data-widget]') === null
                  if (!isBackground) return
                  // Track swipe start (horizontal page nav)
                  swipeRef.current = { startX: e.clientX, startY: e.clientY }
                  // Deselect and start rubber-band
                  selectWidget(null)
                  startRubberBand(e)
                }}
                onPointerUp={(e) => {
                  // Suppress swipe if rubber-band just finished a real drag
                  if (rubberBand && (rubberBand.w > RB_THRESHOLD || rubberBand.h > RB_THRESHOLD)) {
                    swipeRef.current = null
                    return
                  }
                  if (!swipeRef.current) return
                  const dx = e.clientX - swipeRef.current.startX
                  const dy = e.clientY - swipeRef.current.startY
                  swipeRef.current = null

                  // Vertical swipe takes priority over horizontal
                  if (Math.abs(dy) > 28) {
                    if (dy < 0 && !diagOpen && !settingsOpen) setDiagOpen(true)
                    if (dy > 0 && diagOpen) setDiagOpen(false)
                    return
                  }

                  // Horizontal swipe — page navigation (only when overlays are closed)
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
                {/* Grid overlay */}
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

                {/* Page body — either the free-form widget grid (default) or
                    a fixed template preview (#451). When a template is set,
                    the firmware ignores widgets[]; the canvas mirrors that
                    contract so what the user sees is what the device renders. */}
                {(page.template ?? 'custom') === 'cruise_control' ? (
                  <CruiseControlPreview
                    scale={SCALE}
                    canvasW={CANVAS_W}
                    contentH={widgetAreaH * SCALE}
                    palette={effectivePalette}
                  />
                ) : (
                  /* Widgets — warnings always rendered last (on top) */
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

                {/* Rubber-band selection rect */}
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

                {/* Screen settings overlay */}
                {settingsOpen && <ScreenSettingsPanel scale={SCALE} />}

                {/* Diagnostics overlay — swipe up to open, swipe down to close */}
                {diagOpen && <DiagnosticsPanel scale={SCALE} />}

                {/* Rev limit flash overlay — studio-only simulation */}
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
                    {/* Warning triangle */}
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
          {/* end scale wrapper */}
        </div>
        {/* end screen border */}
      </div>
      {/* end wrapperRef */}
    </div>
  )
}
