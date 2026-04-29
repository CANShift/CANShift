// Canvas.tsx — 320×240 widget layout editor.
// Renders all widgets as interactive boxes; supports click-to-select and drag-to-move.

import { useRef, useCallback, useEffect, useState } from 'react'
import type { PageConfig, TopBarConfig, Widget } from '@tmbk/canshift-core'
import { useDashboardStore } from '../../stores/dashboard.store'
import { useDeviceStore } from '../../stores/device.store'
import { IconUsb } from '../icons/Icon'
import ScreenSettingsPanel from './ScreenSettingsPanel'
import { WidgetPreview } from './WidgetPreview'
import { rectsOverlap } from '../../utils/layout'

const SCALE = 1.5 // slightly larger than 1:1 for readability
const CANVAS_W = 320 * SCALE
const CANVAS_H = 240 * SCALE
const GRID = 5 // snap grid in firmware coordinates — matches size token base unit

// ---------------------------------------------------------------------------
// Widget type → border color (used only for selection/type indication)
// ---------------------------------------------------------------------------

const TYPE_BORDER: Record<string, string> = {
  gauge: '#CC3333',
  warning: '#CC7700',
  button: '#336633',
  bar: '#336666',
  gear: '#993399',
  timer: '#226644',
  image: '#555555',
}

function getBorderColor(type: string) {
  return TYPE_BORDER[type] ?? '#444444'
}

// ---------------------------------------------------------------------------
// Drag state (module-level, not React state — avoids re-renders during drag)
// ---------------------------------------------------------------------------

interface DragState {
  widgetId: string
  pageId: string
  startMouseX: number
  startMouseY: number
  startWidgetX: number
  startWidgetY: number
}

let drag: DragState | null = null

// ---------------------------------------------------------------------------
// Single widget renderer
// ---------------------------------------------------------------------------

interface WidgetBoxProps {
  widget: Widget
  isSelected: boolean
  isOverlapping: boolean
  revLimiting: boolean
  onSelect: (id: string) => void
  onDragStart: (e: React.MouseEvent, widget: Widget) => void
}

function WidgetBox({
  widget,
  isSelected,
  isOverlapping,
  revLimiting,
  onSelect,
  onDragStart,
}: WidgetBoxProps) {
  const { layout, type } = widget
  const typeColor = getBorderColor(type)
  const borderColor = isOverlapping ? '#FF2222' : isSelected ? '#FFFFFF' : typeColor
  const borderWidth = isSelected || isOverlapping ? 2 : 1

  return (
    <div
      data-widget="true"
      onMouseDown={(e) => {
        e.stopPropagation()
        onSelect(widget.id)
        onDragStart(e, widget)
      }}
      style={{
        position: 'absolute',
        left: layout.x * SCALE,
        top: layout.y * SCALE,
        width: layout.w * SCALE,
        height: layout.h * SCALE,
        background: isOverlapping ? '#2A0000' : '#0D0D0D',
        border: `${String(borderWidth)}px solid ${borderColor}`,
        borderRadius: 3,
        boxSizing: 'border-box',
        cursor: 'move',
        overflow: 'hidden',
        userSelect: 'none',
        boxShadow: isOverlapping
          ? '0 0 0 1px #FF222244, 0 0 8px #FF222288'
          : isSelected
            ? `0 0 0 1px #FFFFFF22, 0 0 6px ${typeColor}88`
            : `0 0 0 1px ${typeColor}22`,
      }}
    >
      <WidgetPreview
        widget={widget}
        displayW={layout.w * SCALE}
        displayH={layout.h * SCALE}
        revLimiting={revLimiting}
      />
      {isSelected && (
        <div
          style={{
            position: 'absolute',
            right: 0,
            bottom: 0,
            width: 8,
            height: 8,
            background: '#FFFFFF',
            cursor: 'se-resize',
          }}
        />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Dashboard top bar (rendered inside the canvas)
// ---------------------------------------------------------------------------

interface DashTopBarProps {
  topBar: TopBarConfig
  pageName: string
  settingsOpen: boolean
  onOpenSettings: () => void
}

// Swipe-down threshold in px (in SCALE coordinates) to trigger settings open
const SWIPE_DOWN_THRESHOLD = 18

function DashTopBar({ topBar, pageName, settingsOpen, onOpenSettings }: DashTopBarProps) {
  const status = useDeviceStore((s) => s.status)
  const swipeStartY = useRef<number | null>(null)

  const h = topBar.height * SCALE
  const dot = Math.round(h * 0.3)
  const fs = Math.round(h * 0.45)
  const sep = Math.round(h * 0.55)
  const gap = Math.round(h * 0.25)
  const px = Math.round(h * 0.4)
  const iconSz = Math.round(fs * 1.15)

  const usbColor = status === 'connected' ? '#44CC44' : status === 'error' ? '#CC3333' : '#444444'

  const handlePointerDown = (e: React.PointerEvent) => {
    swipeStartY.current = e.clientY
  }

  const handlePointerUp = (e: React.PointerEvent) => {
    if (swipeStartY.current === null) return
    const dy = e.clientY - swipeStartY.current
    swipeStartY.current = null
    if (dy > SWIPE_DOWN_THRESHOLD) onOpenSettings()
    else if (dy < -SWIPE_DOWN_THRESHOLD && settingsOpen) onOpenSettings()
  }

  return (
    <div
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      style={{
        height: h,
        flexShrink: 0,
        background: settingsOpen ? topBar.bgColor + 'CC' : topBar.bgColor,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: `0 ${String(px)}px`,
        boxSizing: 'border-box',
        borderBottom: `1px solid ${settingsOpen ? '#CC333333' : '#1E1E1E'}`,
        userSelect: 'none',
        position: 'relative',
        overflow: 'hidden',
        cursor: 'default',
      }}
    >
      {/* Left — USB + ECU + CAN status */}
      <div style={{ display: 'flex', alignItems: 'center', gap }}>
        <IconUsb size={iconSz} color={usbColor} />
        <span style={{ width: 1, height: sep, background: '#2A2A2A', flexShrink: 0 }} />
        <span
          style={{
            display: 'inline-block',
            width: dot,
            height: dot,
            borderRadius: '50%',
            background: '#44CC44',
            boxShadow: '0 0 3px #44CC4488',
            flexShrink: 0,
          }}
        />
        <span
          style={{ fontSize: fs, color: topBar.textColor, letterSpacing: '0.04em', lineHeight: 1 }}
        >
          ECU
        </span>
        <span style={{ width: 1, height: sep, background: '#2A2A2A', flexShrink: 0 }} />
        <span style={{ fontSize: fs, color: '#444444', lineHeight: 1 }}>CAN</span>
        <span
          style={{
            display: 'inline-block',
            width: dot,
            height: dot,
            borderRadius: '50%',
            background: '#44CC44',
            flexShrink: 0,
          }}
        />
      </div>

      {/* Center — page / map name */}
      {topBar.showMapName && (
        <span
          style={{
            fontSize: fs,
            color: topBar.textColor,
            fontWeight: 600,
            letterSpacing: '0.06em',
            lineHeight: 1,
            position: 'absolute',
            left: '50%',
            transform: 'translateX(-50%)',
            whiteSpace: 'nowrap',
          }}
        >
          {pageName.toUpperCase()}
        </span>
      )}

      {/* Right — battery + USB connection status */}
      <div style={{ display: 'flex', alignItems: 'center', gap }}>
        <span style={{ fontSize: fs, color: '#777777', lineHeight: 1 }}>12.4V</span>
        <span style={{ width: 1, height: sep, background: '#2A2A2A', flexShrink: 0 }} />
        <IconUsb size={iconSz} color={usbColor} />
      </div>

      {/* Swipe-down hint — subtle chevron */}
      <div
        style={{
          position: 'absolute',
          bottom: 1,
          left: '50%',
          transform: 'translateX(-50%)',
          fontSize: fs * 0.7,
          color: '#FFFFFF22',
          lineHeight: 1,
          pointerEvents: 'none',
        }}
      >
        ▾
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Canvas
// ---------------------------------------------------------------------------

interface CanvasProps {
  page: PageConfig
  topBar: TopBarConfig
}

export default function Canvas({ page, topBar }: CanvasProps) {
  const selectedWidgetId = useDashboardStore((s) => s.selectedWidgetId)
  const selectWidget = useDashboardStore((s) => s.selectWidget)
  const moveWidget = useDashboardStore((s) => s.moveWidget)
  const removeWidget = useDashboardStore((s) => s.removeWidget)
  const resolveWidgetCollisions = useDashboardStore((s) => s.resolveWidgetCollisions)
  const pages = useDashboardStore((s) => s.config?.pages ?? [])
  const selectPage = useDashboardStore((s) => s.selectPage)
  const containerRef = useRef<HTMLDivElement>(null)
  const zoomRef = useRef<number>(1)
  // Swipe left/right tracking (page navigation)
  const swipeRef = useRef<{ startX: number; startY: number } | null>(null)

  const widgetAreaH = 240 - (page.showTopBar ? topBar.height : 0)
  const [settingsOpen, setSettingsOpen] = useState(false)
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

  // Compute which widget ids currently overlap — shown with red border as feedback
  const overlappingIds = (() => {
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
        // Only flag non-warning widgets (warnings are allowed on top)
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
  })()

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Delete' && e.key !== 'Backspace') return
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
        return
      if (!selectedWidgetId) return
      e.preventDefault()
      removeWidget(page.id, selectedWidgetId)
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [selectedWidgetId, page.id, removeWidget])

  const handleDragStart = useCallback(
    (e: React.MouseEvent, widget: Widget) => {
      drag = {
        widgetId: widget.id,
        pageId: page.id,
        startMouseX: e.clientX,
        startMouseY: e.clientY,
        startWidgetX: widget.layout.x,
        startWidgetY: widget.layout.y,
      }

      const handleMouseMove = (ev: MouseEvent) => {
        if (!drag) return
        const effectiveScale = SCALE * zoomRef.current
        const dx = Math.round((ev.clientX - drag.startMouseX) / effectiveScale)
        const dy = Math.round((ev.clientY - drag.startMouseY) / effectiveScale)
        // Snap to GRID, clamp to canvas bounds accounting for widget dimensions
        const rawX = drag.startWidgetX + dx
        const rawY = drag.startWidgetY + dy
        const snappedX = Math.round(rawX / GRID) * GRID
        const snappedY = Math.round(rawY / GRID) * GRID
        const newX = Math.max(0, Math.min(320 - widget.layout.w, snappedX))
        const newY = Math.max(0, Math.min(widgetAreaH - widget.layout.h, snappedY))
        moveWidget(drag.pageId, drag.widgetId, { x: newX, y: newY })
      }

      const handleMouseUp = () => {
        if (drag) {
          // Resolve overlaps after drop — cascade-push colliding widgets
          resolveWidgetCollisions(drag.pageId, drag.widgetId)
        }
        drag = null
        window.removeEventListener('mousemove', handleMouseMove)
        window.removeEventListener('mouseup', handleMouseUp)
      }

      window.addEventListener('mousemove', handleMouseMove)
      window.addEventListener('mouseup', handleMouseUp)
    },
    [page.id, moveWidget, resolveWidgetCollisions]
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
      {/* Studio toolbar — rev limit simulation (studio-only, not on device) */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          padding: '4px 10px',
          borderBottom: '1px solid #1A1A1A',
          gap: 8,
          flexShrink: 0,
        }}
      >
        <span style={{ fontSize: 9, color: '#333333', letterSpacing: '0.05em' }}>
          PREVIEW — 320 × 240
        </span>
        <button
          onClick={() => {
            setRevLimiting(true)
          }}
          disabled={revLimiting}
          title="Simulate rev limiter (5s)"
          style={{
            padding: '2px 8px',
            fontSize: 10,
            background: revLimiting ? '#3A0000' : 'transparent',
            border: `1px solid ${revLimiting ? '#CC0000' : '#2A2A2A'}`,
            borderRadius: 3,
            color: revLimiting ? '#FF4444' : '#444444',
            cursor: revLimiting ? 'default' : 'pointer',
            letterSpacing: '0.04em',
          }}
        >
          ⚡ Rev Limit
        </button>
      </div>

      {/* Canvas area — scrollable if window is smaller than 320×240 */}
      <div
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
                background: page.backgroundColor,
                overflow: 'hidden',
              }}
            >
              {/* Dashboard top bar — fixed height, pushes widget area down */}
              {page.showTopBar && (
                <DashTopBar
                  topBar={topBar}
                  pageName={page.name}
                  settingsOpen={settingsOpen}
                  onOpenSettings={() => {
                    setSettingsOpen((o) => !o)
                  }}
                />
              )}

              {/* Widget area — coordinate origin (0,0) is below the top bar */}
              <div
                ref={containerRef}
                onPointerDown={(e) => {
                  // Track swipe start — only on background clicks (no widget under cursor)
                  const target = e.target as HTMLElement
                  if (target === containerRef.current || target.closest('[data-widget]') === null) {
                    swipeRef.current = { startX: e.clientX, startY: e.clientY }
                  }
                  selectWidget(null)
                }}
                onPointerUp={(e) => {
                  if (!swipeRef.current) return
                  const dx = e.clientX - swipeRef.current.startX
                  const dy = Math.abs(e.clientY - swipeRef.current.startY)
                  swipeRef.current = null
                  if (dy > 20 || Math.abs(dx) < 40) return // not a horizontal swipe
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
                    backgroundSize: `${String(10 * SCALE)}px ${String(10 * SCALE)}px`,
                    pointerEvents: 'none',
                  }}
                />

                {/* Widgets — warnings always rendered last (on top) */}
                {[
                  ...page.widgets.filter((w) => w.type !== 'warning'),
                  ...page.widgets.filter((w) => w.type === 'warning'),
                ].map((widget) => (
                  <WidgetBox
                    key={widget.id}
                    widget={widget}
                    isSelected={widget.id === selectedWidgetId}
                    isOverlapping={overlappingIds.has(widget.id)}
                    revLimiting={revLimiting}
                    onSelect={selectWidget}
                    onDragStart={handleDragStart}
                  />
                ))}

                {/* Screen settings overlay page */}
                {settingsOpen && <ScreenSettingsPanel scale={SCALE} />}

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
