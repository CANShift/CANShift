// Canvas.tsx — 320×240 widget layout editor.
// Renders all widgets as interactive boxes; supports click-to-select and drag-to-move.

import { useRef, useCallback, useEffect, useState } from 'react'
import type { PageConfig, TopBarConfig, Widget, SensorIconName } from '@tmbk/canshift-core'
import { useDashboardStore } from '../../stores/dashboard.store'
import { SensorIcon } from '../icons/SensorIcons'
import ScreenSettingsPanel from './ScreenSettingsPanel'

const SCALE = 2 // 320×240 → 640×480 on screen
const CANVAS_W = 320 * SCALE
const CANVAS_H = 240 * SCALE

// ---------------------------------------------------------------------------
// Widget type → color mapping
// ---------------------------------------------------------------------------

const TYPE_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  gauge: { bg: '#1A0A0A', border: '#CC3333', text: '#FF5555' },
  label: { bg: '#0A0A1A', border: '#3355CC', text: '#5577FF' },
  warning: { bg: '#1A1000', border: '#CC7700', text: '#FFAA00' },
  button: { bg: '#0A1A0A', border: '#336633', text: '#55AA55' },
  bar: { bg: '#001A1A', border: '#336666', text: '#55AAAA' },
  gear: { bg: '#1A001A', border: '#993399', text: '#CC55CC' },
  timer: { bg: '#001A10', border: '#226644', text: '#44AA77' },
  image: { bg: '#1A1A1A', border: '#555555', text: '#888888' },
}

function getColors(type: string) {
  return TYPE_COLORS[type] ?? { bg: '#1A1A1A', border: '#444444', text: '#888888' }
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
// Widget icon resolver
// ---------------------------------------------------------------------------

function resolveIconName(widget: Widget): SensorIconName | null {
  const cfg = widget.config
  if ('iconName' in cfg) return cfg.iconName ?? null
  return null
}

// ---------------------------------------------------------------------------
// Single widget renderer
// ---------------------------------------------------------------------------

interface WidgetBoxProps {
  widget: Widget
  isSelected: boolean
  onSelect: (id: string) => void
  onDragStart: (e: React.MouseEvent, widget: Widget) => void
}

function WidgetBox({ widget, isSelected, onSelect, onDragStart }: WidgetBoxProps) {
  const { layout, type, signal, config } = widget
  const colors = getColors(type)
  const iconName = resolveIconName(widget)

  const label =
    'label' in config && typeof config.label === 'string' ? config.label : signal || type

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
        background: colors.bg,
        border: `${String(isSelected ? 2 : 1)}px solid ${isSelected ? '#FFFFFF' : colors.border}`,
        borderRadius: 3,
        boxSizing: 'border-box',
        cursor: 'move',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 2,
        userSelect: 'none',
        boxShadow: isSelected ? `0 0 0 1px #FFFFFF44, 0 0 8px ${colors.border}88` : 'none',
      }}
    >
      {iconName && (
        <SensorIcon
          name={iconName}
          size={Math.min(layout.w, layout.h) * SCALE * 0.35}
          color={colors.text}
        />
      )}
      <span
        style={{
          fontSize: Math.max(8, Math.min(11, layout.h * SCALE * 0.2)),
          color: colors.text,
          fontWeight: 600,
          letterSpacing: '0.03em',
          textTransform: 'uppercase',
          lineHeight: 1,
          maxWidth: '90%',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          textAlign: 'center',
        }}
      >
        {type}
      </span>
      {layout.w * SCALE > 48 && layout.h * SCALE > 28 && (
        <span
          style={{
            fontSize: Math.max(7, Math.min(9, layout.h * SCALE * 0.15)),
            color: '#666666',
            maxWidth: '90%',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            textAlign: 'center',
          }}
        >
          {label}
        </span>
      )}
      {isSelected && (
        <>
          {/* Resize handle — bottom-right corner (visual only for now) */}
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
        </>
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
  onOpenSettings: () => void
}

function DashTopBar({ topBar, pageName, onOpenSettings }: DashTopBarProps) {
  // All sizes derived from bar height so content scales correctly at any height
  const h       = topBar.height * SCALE
  const dot     = Math.round(h * 0.30)
  const fs      = Math.round(h * 0.45)
  const sep     = Math.round(h * 0.55)
  const gap     = Math.round(h * 0.25)
  const px      = Math.round(h * 0.40)

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
      {/* Left — ECU + CAN status */}
      <div style={{ display: 'flex', alignItems: 'center', gap }}>
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
        <span style={{ fontSize: fs, color: topBar.textColor, letterSpacing: '0.04em', lineHeight: 1 }}>
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
        {/* Settings gear button */}
        <button
          onClick={(e) => {
            e.stopPropagation()
            onOpenSettings()
          }}
          title="Screen settings"
          style={{
            background: 'none',
            border: 'none',
            padding: 0,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            color: '#555555',
            lineHeight: 1,
          }}
        >
          <svg
            width={Math.round(fs * 1.1)}
            height={Math.round(fs * 1.1)}
            viewBox="0 0 16 16"
            fill="none"
          >
            <path
              d="M6.5 2.5h3l.5 1.5a4 4 0 0 1 1.1.65l1.5-.4 1.5 2.6-1.1 1.1c.03.35.03.7 0 1.05l1.1 1.1-1.5 2.6-1.5-.4A4 4 0 0 1 10 12l-.5 1.5h-3L6 12a4 4 0 0 1-1.1-.65l-1.5.4-1.5-2.6 1.1-1.1a4 4 0 0 1 0-1.05L1.9 5.85l1.5-2.6 1.5.4A4 4 0 0 1 6 3.5L6.5 2.5Z"
              stroke="currentColor"
              strokeWidth="1.1"
              strokeLinejoin="round"
            />
            <circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.1" />
          </svg>
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
  const containerRef = useRef<HTMLDivElement>(null)

  const widgetAreaH = 240 - (page.showTopBar ? topBar.height : 0)
  const [settingsOpen, setSettingsOpen] = useState(false)

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
        const newX = Math.max(0, Math.min(320 - 10, drag.startWidgetX + dx))
        const newY = Math.max(0, Math.min(widgetAreaH - 10, drag.startWidgetY + dy))
        moveWidget(drag.pageId, drag.widgetId, { x: newX, y: newY })
      }

      const handleMouseUp = () => {
        drag = null
        window.removeEventListener('mousemove', handleMouseMove)
        window.removeEventListener('mouseup', handleMouseUp)
      }

      window.addEventListener('mousemove', handleMouseMove)
      window.addEventListener('mouseup', handleMouseUp)
    },
    [page.id, moveWidget]
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
              onOpenSettings={() => { setSettingsOpen(true) }}
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

            {/* Widgets */}
            {page.widgets.map((widget) => (
              <WidgetBox
                key={widget.id}
                widget={widget}
                isSelected={widget.id === selectedWidgetId}
                onSelect={selectWidget}
                onDragStart={handleDragStart}
              />
            ))}

            {/* Screen settings overlay page */}
            {settingsOpen && (
              <ScreenSettingsPanel
                scale={SCALE}
                onClose={() => { setSettingsOpen(false) }}
              />
            )}
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
