// Canvas.tsx — 320×240 widget layout editor.
// Renders all widgets as interactive boxes; supports click-to-select and drag-to-move.

import { useRef, useCallback, useEffect, useState } from 'react'
import type { PageConfig, TopBarConfig, Widget } from '@tmbk/canshift-core'
import { useDashboardStore } from '../../stores/dashboard.store'
import { useDeviceStore } from '../../stores/device.store'
import { IconSettings, IconClear, IconUsb } from '../icons/Icon'
import ScreenSettingsPanel from './ScreenSettingsPanel'
import { WidgetPreview } from './WidgetPreview'
import { rectsOverlap } from '../../utils/layout'

const SCALE = 2 // 320×240 → 640×480 on screen
const CANVAS_W = 320 * SCALE
const CANVAS_H = 240 * SCALE
const GRID = 10 // snap grid in firmware coordinates

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
  onSelect: (id: string) => void
  onDragStart: (e: React.MouseEvent, widget: Widget) => void
}

function WidgetBox({ widget, isSelected, isOverlapping, onSelect, onDragStart }: WidgetBoxProps) {
  const { layout, type } = widget
  const typeColor = getBorderColor(type)
  const borderColor = isOverlapping ? '#FF2222' : isSelected ? '#FFFFFF' : typeColor
  const borderWidth = isSelected || isOverlapping ? 2 : 1

  return (
    <div
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
      <WidgetPreview widget={widget} displayW={layout.w * SCALE} displayH={layout.h * SCALE} />
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

function DashTopBar({ topBar, pageName, settingsOpen, onOpenSettings }: DashTopBarProps) {
  const status = useDeviceStore((s) => s.status)

  // All sizes derived from bar height so content scales correctly at any height
  const h = topBar.height * SCALE
  const dot = Math.round(h * 0.3)
  const fs = Math.round(h * 0.45)
  const sep = Math.round(h * 0.55)
  const gap = Math.round(h * 0.25)
  const px = Math.round(h * 0.4)
  const iconSz = Math.round(fs * 1.15)

  const usbColor = status === 'connected' ? '#44CC44' : status === 'error' ? '#CC3333' : '#444444'

  return (
    <div
      style={{
        height: h,
        flexShrink: 0,
        background: topBar.bgColor,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: `0 ${String(px)}px`,
        boxSizing: 'border-box',
        borderBottom: '1px solid #1E1E1E',
        userSelect: 'none',
        pointerEvents: 'none',
        position: 'relative',
        overflow: 'hidden',
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

      {/* Right — battery + settings button */}
      <div style={{ display: 'flex', alignItems: 'center', gap, pointerEvents: 'auto' }}>
        <span style={{ fontSize: fs, color: '#777777', lineHeight: 1 }}>12.4V</span>
        <span style={{ width: 1, height: sep, background: '#2A2A2A', flexShrink: 0 }} />
        {/* Settings button — gear when closed, X when open */}
        <button
          onClick={(e) => {
            e.stopPropagation()
            onOpenSettings()
          }}
          title={settingsOpen ? 'Close settings' : 'Screen settings'}
          style={{
            background: 'none',
            border: 'none',
            padding: 0,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            color: settingsOpen ? '#CC3333' : '#555555',
            lineHeight: 1,
            transition: 'color 0.15s',
          }}
        >
          {settingsOpen ? (
            <IconClear size={iconSz} color="#CC3333" />
          ) : (
            <IconSettings size={iconSz} color="#555555" />
          )}
        </button>
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
  const containerRef = useRef<HTMLDivElement>(null)

  const widgetAreaH = 240 - (page.showTopBar ? topBar.height : 0)
  const [settingsOpen, setSettingsOpen] = useState(false)

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
        const dx = Math.round((ev.clientX - drag.startMouseX) / SCALE)
        const dy = Math.round((ev.clientY - drag.startMouseY) / SCALE)
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
        alignItems: 'center',
        justifyContent: 'center',
        flex: 1,
        background: '#111111',
        overflow: 'auto',
        padding: 24,
      }}
    >
      {/* Outer frame to mimic the physical screen border */}
      <div
        style={{
          background: '#000000',
          border: '3px solid #2A2A2A',
          borderRadius: 6,
          padding: 6,
          boxShadow: '0 8px 32px #00000088',
        }}
      >
        {/* The 320×240 canvas at 2× zoom */}
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
            onMouseDown={() => {
              selectWidget(null)
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
                onSelect={selectWidget}
                onDragStart={handleDragStart}
              />
            ))}

            {/* Screen settings overlay page */}
            {settingsOpen && <ScreenSettingsPanel scale={SCALE} />}
          </div>
        </div>

        {/* Canvas label */}
        <div
          style={{
            textAlign: 'center',
            fontSize: 10,
            color: '#333333',
            marginTop: 4,
            letterSpacing: '0.05em',
          }}
        >
          320 × 240 px — {SCALE}× preview
        </div>
      </div>
    </div>
  )
}
