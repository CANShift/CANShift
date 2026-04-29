// Canvas.tsx — 320×240 widget layout editor.
// Renders all widgets as interactive boxes; supports click-to-select and drag-to-move.

import { useRef, useCallback, useEffect } from 'react'
import type { PageConfig, TopBarConfig, Widget, SensorIconName } from '@tmbk/canshift-core'
import { useDashboardStore } from '../../stores/dashboard.store'
import { SensorIcon } from '../icons/SensorIcons'

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
}

function DashTopBar({ topBar, pageName }: DashTopBarProps) {
  return (
    <div
      style={{
        height: topBar.height * SCALE,
        flexShrink: 0,
        background: topBar.bgColor,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: `0 ${String(SCALE * 4)}px`,
        boxSizing: 'border-box',
        borderBottom: '1px solid #1E1E1E',
        userSelect: 'none',
        pointerEvents: 'none',
        position: 'relative',
      }}
    >
      {/* Left — ECU connection status */}
      <div style={{ display: 'flex', alignItems: 'center', gap: SCALE * 3 }}>
        <span
          style={{
            display: 'inline-block',
            width: SCALE * 4,
            height: SCALE * 4,
            borderRadius: '50%',
            background: '#44CC44',
            boxShadow: '0 0 4px #44CC4488',
            flexShrink: 0,
          }}
        />
        <span style={{ fontSize: SCALE * 5.5, color: topBar.textColor, letterSpacing: '0.04em' }}>
          ECU
        </span>
        <span
          style={{
            width: 1,
            height: SCALE * 6,
            background: '#2A2A2A',
            margin: `0 ${String(SCALE)}px`,
          }}
        />
        <span style={{ fontSize: SCALE * 5.5, color: '#444444' }}>CAN</span>
        <span
          style={{
            display: 'inline-block',
            width: SCALE * 4,
            height: SCALE * 4,
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
            fontSize: SCALE * 6,
            color: topBar.textColor,
            fontWeight: 600,
            letterSpacing: '0.06em',
            position: 'absolute',
            left: '50%',
            transform: 'translateX(-50%)',
          }}
        >
          {pageName.toUpperCase()}
        </span>
      )}

      {/* Right — battery + time */}
      <div style={{ display: 'flex', alignItems: 'center', gap: SCALE * 4 }}>
        <span style={{ fontSize: SCALE * 5.5, color: '#888888' }}>12.4V</span>
        <span
          style={{
            width: 1,
            height: SCALE * 6,
            background: '#2A2A2A',
          }}
        />
        <span style={{ fontSize: SCALE * 5.5, color: '#555555' }}>SIM</span>
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
          {page.showTopBar && <DashTopBar topBar={topBar} pageName={page.name} />}

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
