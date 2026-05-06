// Canvas.tsx — 320×240 widget layout editor.
// Supports click/Shift+click selection, rubber-band multi-select, drag-to-move,
// alignment tools, and swipe gestures for page navigation.

import { useRef, useCallback, useEffect, useState } from 'react'
import type { PageConfig, PagePalette, TopBarConfig, TopBarItem, Widget } from '@tmbk/canshift-core'
import { DEFAULT_TOP_BAR_LAYOUT } from '@tmbk/canshift-core'
import { useDashboardStore } from '../../stores/dashboard.store'
import type { AlignDirection } from '../../stores/dashboard.store'
import { useDeviceStore } from '../../stores/device.store'
import { IconUsb } from '../icons/Icon'
import ScreenSettingsPanel from './ScreenSettingsPanel'
import DiagnosticsPanel from './DiagnosticsPanel'
import { WidgetPreview } from './WidgetPreview'
import { rectsOverlap } from '../../utils/layout'
import { DAY_PALETTE_DEFAULT, DAY_BG_DEFAULT } from '../../constants/theme'

// ---------------------------------------------------------------------------
// Canvas layout constants
// ---------------------------------------------------------------------------

// Display scale factor: the firmware renders at 320×240; we show it at 1.5× for
// readability. All firmware-pixel values are multiplied by SCALE before rendering.
const SCALE = 1.5
const CANVAS_W = 320 * SCALE
const CANVAS_H = 240 * SCALE

// Snap grid in firmware pixels — match the firmware's minimum token dimensions.
// X_SNAP = 40 px wide (narrowest visible column), Y_SNAP = 28 px tall (narrowest row).
const X_SNAP = 40
const Y_SNAP = 28

// Minimum rubber-band drag distance (firmware px) before activating selection
const RB_THRESHOLD = 4

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
  image: '#AAAAAA',
}

function getBorderColor(type: string) {
  return TYPE_BORDER[type] ?? '#AAAAAA'
}

// ---------------------------------------------------------------------------
// Drag state (module-level — avoids re-renders during drag)
// ---------------------------------------------------------------------------

interface DraggingWidget {
  id: string
  startX: number
  startY: number
  w: number
  h: number
}

interface DragState {
  primaryId: string
  pageId: string
  startMouseX: number
  startMouseY: number
  widgets: DraggingWidget[]
  isMulti: boolean
}

let drag: DragState | null = null

// ---------------------------------------------------------------------------
// Alignment toolbar
// ---------------------------------------------------------------------------

interface AlignToolbarProps {
  pageId: string
  widgetIds: string[]
  canDistribute: boolean
}

const ALIGN_BUTTONS: { dir: AlignDirection; label: string; title: string }[] = [
  { dir: 'left', label: '⬤⬜⬜', title: 'Align left edges' },
  { dir: 'center-h', label: '⬜⬤⬜', title: 'Center horizontally' },
  { dir: 'right', label: '⬜⬜⬤', title: 'Align right edges' },
  { dir: 'top', label: '⬤⬜⬜', title: 'Align top edges' },
  { dir: 'center-v', label: '⬜⬤⬜', title: 'Center vertically' },
  { dir: 'bottom', label: '⬜⬜⬤', title: 'Align bottom edges' },
]

function AlignToolbar({ pageId, widgetIds, canDistribute }: AlignToolbarProps) {
  const alignWidgets = useDashboardStore((s) => s.alignWidgets)
  const distributeWidgets = useDashboardStore((s) => s.distributeWidgets)

  const btnStyle: React.CSSProperties = {
    padding: '2px 7px',
    fontSize: 10,
    background: '#1A1A1A',
    border: '1px solid #2A2A2A',
    borderRadius: 3,
    color: '#888888',
    cursor: 'pointer',
    letterSpacing: '0.03em',
    fontFamily: 'monospace',
    lineHeight: 1.2,
  }

  const labelStyle: React.CSSProperties = {
    fontSize: 9,
    color: '#555555',
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    alignSelf: 'center',
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      <span style={labelStyle}>Align</span>
      {/* Horizontal */}
      <button
        style={btnStyle}
        title="Align left edges"
        onClick={() => {
          alignWidgets(pageId, widgetIds, 'left')
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = '#555555'
          e.currentTarget.style.color = '#CCCCCC'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = '#2A2A2A'
          e.currentTarget.style.color = '#888888'
        }}
      >
        ←
      </button>
      <button
        style={btnStyle}
        title="Center horizontally"
        onClick={() => {
          alignWidgets(pageId, widgetIds, 'center-h')
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = '#555555'
          e.currentTarget.style.color = '#CCCCCC'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = '#2A2A2A'
          e.currentTarget.style.color = '#888888'
        }}
      >
        ↔
      </button>
      <button
        style={btnStyle}
        title="Align right edges"
        onClick={() => {
          alignWidgets(pageId, widgetIds, 'right')
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = '#555555'
          e.currentTarget.style.color = '#CCCCCC'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = '#2A2A2A'
          e.currentTarget.style.color = '#888888'
        }}
      >
        →
      </button>
      {/* Vertical */}
      <button
        style={btnStyle}
        title="Align top edges"
        onClick={() => {
          alignWidgets(pageId, widgetIds, 'top')
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = '#555555'
          e.currentTarget.style.color = '#CCCCCC'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = '#2A2A2A'
          e.currentTarget.style.color = '#888888'
        }}
      >
        ↑
      </button>
      <button
        style={btnStyle}
        title="Center vertically"
        onClick={() => {
          alignWidgets(pageId, widgetIds, 'center-v')
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = '#555555'
          e.currentTarget.style.color = '#CCCCCC'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = '#2A2A2A'
          e.currentTarget.style.color = '#888888'
        }}
      >
        ↕
      </button>
      <button
        style={btnStyle}
        title="Align bottom edges"
        onClick={() => {
          alignWidgets(pageId, widgetIds, 'bottom')
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = '#555555'
          e.currentTarget.style.color = '#CCCCCC'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = '#2A2A2A'
          e.currentTarget.style.color = '#888888'
        }}
      >
        ↓
      </button>
      {/* Distribute (only enabled when 3+ widgets selected) */}
      {canDistribute && (
        <>
          <div style={{ width: 1, height: 14, background: '#2A2A2A', margin: '0 2px' }} />
          <span style={labelStyle}>Dist</span>
          <button
            style={btnStyle}
            title="Distribute horizontally"
            onClick={() => {
              distributeWidgets(pageId, widgetIds, 'h')
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = '#555555'
              e.currentTarget.style.color = '#CCCCCC'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = '#2A2A2A'
              e.currentTarget.style.color = '#888888'
            }}
          >
            ⇔
          </button>
          <button
            style={btnStyle}
            title="Distribute vertically"
            onClick={() => {
              distributeWidgets(pageId, widgetIds, 'v')
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = '#555555'
              e.currentTarget.style.color = '#CCCCCC'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = '#2A2A2A'
              e.currentTarget.style.color = '#888888'
            }}
          >
            ⇕
          </button>
        </>
      )}
    </div>
  )
}

// Suppress unused-import warning for ALIGN_BUTTONS
void ALIGN_BUTTONS

// ---------------------------------------------------------------------------
// Single widget renderer
// ---------------------------------------------------------------------------

interface WidgetBoxProps {
  widget: Widget
  palette: PagePalette
  isSelected: boolean
  isInMultiSelection: boolean
  isOverlapping: boolean
  revLimiting: boolean
  onSelect: (id: string) => void
  onShiftSelect: (id: string) => void
  onDragStart: (e: React.MouseEvent, widget: Widget) => void
}

function WidgetBox({
  widget,
  palette,
  isSelected,
  isInMultiSelection,
  isOverlapping,
  revLimiting,
  onSelect,
  onShiftSelect,
  onDragStart,
}: WidgetBoxProps) {
  const { layout, type } = widget
  const typeColor = getBorderColor(type)
  const configuredBorder = widget.style.borderColor
  const borderColor = isOverlapping
    ? '#FF2222'
    : isSelected
      ? '#FFFFFF'
      : isInMultiSelection
        ? '#AAAAFF'
        : (configuredBorder ?? typeColor)
  const borderWidth = isSelected || isOverlapping || isInMultiSelection ? 2 : 1
  const bgColor = isOverlapping ? '#2A0000' : isInMultiSelection ? '#0A0A1E' : palette.surface

  return (
    <div
      data-widget="true"
      onMouseDown={(e) => {
        e.stopPropagation()
        if (e.shiftKey) {
          onShiftSelect(widget.id)
        } else {
          onSelect(widget.id)
          onDragStart(e, widget)
        }
      }}
      style={{
        position: 'absolute',
        left: layout.x * SCALE,
        top: layout.y * SCALE,
        width: layout.w * SCALE,
        height: layout.h * SCALE,
        background: bgColor,
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
            : isInMultiSelection
              ? '0 0 0 1px #AAAAFF22, 0 0 4px #AAAAFF44'
              : `0 0 0 1px ${typeColor}22`,
      }}
    >
      <WidgetPreview
        widget={widget}
        palette={palette}
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
  settingsOpen: boolean
  isDayMode: boolean
  onOpenSettings: () => void
  onToggleTheme: () => void
}

// Swipe-down threshold in px (in SCALE coordinates) to trigger settings open
const SWIPE_DOWN_THRESHOLD = 18

// Representative preview values for `signal` items in the top bar — the studio
// has no live ECU data, so we show a static plausible reading. The signal name
// drives which placeholder is used; unknown signals fall back to "--".
const PREVIEW_SIGNAL_VALUES: Record<string, number> = {
  battery_volts: 12.4,
  rpm: 3500,
  speed_kph: 80,
  coolant_temp_c: 88,
  oil_press_bar: 4.2,
  oil_temp_c: 95,
}

function formatPreviewSignal(signal: string, format?: string): string {
  const value = PREVIEW_SIGNAL_VALUES[signal]
  if (value === undefined) return '--'
  if (!format) return value.toFixed(1)
  // Minimal printf %.<N>f handler — the only format we expose in the schema.
  const m = /%\.(\d+)f(.*)/.exec(format)
  if (!m) return format.replace('%f', value.toFixed(1))
  const decimals = parseInt(m[1] ?? '1', 10)
  const suffix = m[2] ?? ''
  return value.toFixed(decimals) + suffix
}

function DashTopBar({
  topBar,
  settingsOpen,
  isDayMode,
  onOpenSettings,
  onToggleTheme,
}: DashTopBarProps) {
  const status = useDeviceStore((s) => s.status)
  const swipeStartY = useRef<number | null>(null)

  const h = topBar.height * SCALE
  const dot = Math.round(h * 0.3)
  const fs = Math.round(h * 0.45)
  const sep = Math.round(h * 0.55)
  const gap = Math.round(h * 0.25)
  const px = Math.round(h * 0.4)
  const iconSz = Math.round(fs * 1.15)

  const usbColor = status === 'connected' ? '#44CC44' : status === 'error' ? '#CC3333' : '#AAAAAA'

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

  const layout: TopBarItem[] = topBar.layout ?? DEFAULT_TOP_BAR_LAYOUT
  const leftItems = layout.filter((it) => it.position === 'left')
  const centerItems = layout.filter((it) => it.position === 'center')
  const rightItems = layout.filter((it) => it.position === 'right')

  const renderItem = (item: TopBarItem, key: number) => {
    switch (item.type) {
      case 'statusDot':
        return (
          <span
            key={key}
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
        )
      case 'label':
        return (
          <span
            key={key}
            style={{
              fontSize: fs,
              color: topBar.textColor,
              letterSpacing: '0.04em',
              lineHeight: 1,
            }}
          >
            {item.text}
          </span>
        )
      case 'separator':
        return (
          <span key={key} style={{ width: 1, height: sep, background: '#2A2A2A', flexShrink: 0 }} />
        )
      case 'signal':
        // Studio preview can't read live device values — show a representative
        // sample formatted with the configured pattern. Falls back to a generic
        // placeholder if the format is omitted.
        return (
          <span key={key} style={{ fontSize: fs, color: '#777777', lineHeight: 1 }}>
            {formatPreviewSignal(item.signal, item.format)}
          </span>
        )
      case 'usbIcon':
        return <IconUsb key={key} size={iconSz} color={usbColor} />
      case 'themeToggle':
        return (
          <button
            key={key}
            onPointerDown={(e) => {
              e.stopPropagation()
            }}
            onPointerUp={(e) => {
              e.stopPropagation()
            }}
            onClick={(e) => {
              e.stopPropagation()
              onToggleTheme()
            }}
            title={isDayMode ? 'Switch to night mode' : 'Switch to day mode'}
            style={{
              background: 'none',
              border: 'none',
              padding: 0,
              cursor: 'pointer',
              fontSize: fs + 1,
              lineHeight: 1,
              color: topBar.textColor,
              flexShrink: 0,
            }}
          >
            {isDayMode ? '☾' : '☀'}
          </button>
        )
    }
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
      <div style={{ display: 'flex', alignItems: 'center', gap }}>
        {leftItems.map((it, i) => renderItem(it, i))}
      </div>

      {centerItems.length > 0 && (
        <div
          style={{
            position: 'absolute',
            left: '50%',
            transform: 'translateX(-50%)',
            display: 'flex',
            alignItems: 'center',
            gap,
          }}
        >
          {centerItems.map((it, i) => renderItem(it, i))}
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap }}>
        {rightItems.map((it, i) => renderItem(it, i))}
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
  const selectedWidgetIds = useDashboardStore((s) => s.selectedWidgetIds)
  const selectWidget = useDashboardStore((s) => s.selectWidget)
  const selectWidgets = useDashboardStore((s) => s.selectWidgets)
  const toggleWidgetSelection = useDashboardStore((s) => s.toggleWidgetSelection)
  const moveWidget = useDashboardStore((s) => s.moveWidget)
  const moveWidgets = useDashboardStore((s) => s.moveWidgets)
  const removeWidget = useDashboardStore((s) => s.removeWidget)
  const resolveWidgetCollisions = useDashboardStore((s) => s.resolveWidgetCollisions)
  const commitDrag = useDashboardStore((s) => s.commitDrag)
  const togglePreviewTheme = useDashboardStore((s) => s.togglePreviewTheme)
  const isPreviewDayMode = useDashboardStore((s) => s.isPreviewDayMode)
  const dayTheme = useDashboardStore((s) => s.config?.dayTheme)
  const pages = useDashboardStore((s) => s.config?.pages ?? [])
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

  const widgetAreaH = 240 - topBar.height

  // Effective palette and background — follow the preview day/night toggle.
  // Falls back to built-in defaults when config.dayTheme hasn't been configured yet.
  const effectivePalette: PagePalette = isPreviewDayMode
    ? (dayTheme?.palette ?? DAY_PALETTE_DEFAULT)
    : page.palette
  const effectiveBgColor: string = isPreviewDayMode
    ? (dayTheme?.bgColor ?? DAY_BG_DEFAULT)
    : page.backgroundColor

  const handleToggleTheme = useCallback(() => {
    togglePreviewTheme()
  }, [togglePreviewTheme])

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
      // Gather all widgets to drag: if the widget is part of multi-selection, drag all.
      // Otherwise drag only this widget (and set it as sole selection).
      const isMulti = selectedWidgetIds.length > 1 && selectedWidgetIds.includes(widget.id)

      const dragging: DraggingWidget[] = isMulti
        ? page.widgets
            .filter((w) => selectedWidgetIds.includes(w.id))
            .map((w) => ({
              id: w.id,
              startX: w.layout.x,
              startY: w.layout.y,
              w: w.layout.w,
              h: w.layout.h,
            }))
        : [
            {
              id: widget.id,
              startX: widget.layout.x,
              startY: widget.layout.y,
              w: widget.layout.w,
              h: widget.layout.h,
            },
          ]

      drag = {
        primaryId: widget.id,
        pageId: page.id,
        startMouseX: e.clientX,
        startMouseY: e.clientY,
        widgets: dragging,
        isMulti,
      }

      const handleMouseMove = (ev: MouseEvent) => {
        if (!drag) return
        const effectiveScale = SCALE * zoomRef.current
        const dx = Math.round((ev.clientX - drag.startMouseX) / effectiveScale)
        const dy = Math.round((ev.clientY - drag.startMouseY) / effectiveScale)

        if (drag.isMulti) {
          const moves = drag.widgets.map((dw) => {
            const rawX = dw.startX + dx
            const rawY = dw.startY + dy
            const snappedX = Math.round(rawX / X_SNAP) * X_SNAP
            const snappedY = Math.round(rawY / Y_SNAP) * Y_SNAP
            return {
              id: dw.id,
              x: Math.max(0, Math.min(320 - dw.w, snappedX)),
              y: Math.max(0, Math.min(widgetAreaH - dw.h, snappedY)),
            }
          })
          moveWidgets(drag.pageId, moves)
        } else {
          const dw = drag.widgets[0]
          if (!dw) return
          const rawX = dw.startX + dx
          const rawY = dw.startY + dy
          const snappedX = Math.round(rawX / X_SNAP) * X_SNAP
          const snappedY = Math.round(rawY / Y_SNAP) * Y_SNAP
          const newX = Math.max(0, Math.min(320 - dw.w, snappedX))
          const newY = Math.max(0, Math.min(widgetAreaH - dw.h, snappedY))
          moveWidget(drag.pageId, drag.primaryId, { x: newX, y: newY })
        }
      }

      const handleMouseUp = () => {
        if (drag) {
          if (drag.isMulti) {
            commitDrag()
          } else {
            resolveWidgetCollisions(drag.pageId, drag.primaryId)
          }
        }
        drag = null
        window.removeEventListener('mousemove', handleMouseMove)
        window.removeEventListener('mouseup', handleMouseUp)
      }

      window.addEventListener('mousemove', handleMouseMove)
      window.addEventListener('mouseup', handleMouseUp)
    },
    [
      page.id,
      page.widgets,
      selectedWidgetIds,
      moveWidget,
      moveWidgets,
      resolveWidgetCollisions,
      commitDrag,
      widgetAreaH,
    ]
  )

  // Rubber-band: starts on background mousedown, selects widgets on mouseup
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

      // Capture page.widgets at drag-start time (closure)
      const widgets = page.widgets

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
    [page.widgets, selectWidgets]
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
            PREVIEW — 320 × 240
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
                  settingsOpen={settingsOpen}
                  isDayMode={isPreviewDayMode}
                  onOpenSettings={() => {
                    setSettingsOpen((o) => !o)
                  }}
                  onToggleTheme={handleToggleTheme}
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

                {/* Widgets — warnings always rendered last (on top) */}
                {[
                  ...page.widgets.filter((w) => w.type !== 'warning'),
                  ...page.widgets.filter((w) => w.type === 'warning'),
                ].map((widget) => (
                  <WidgetBox
                    key={widget.id}
                    widget={widget}
                    palette={effectivePalette}
                    isSelected={widget.id === selectedWidgetId}
                    isInMultiSelection={
                      selectedWidgetIds.length > 1 && selectedWidgetIds.includes(widget.id)
                    }
                    isOverlapping={overlappingIds.has(widget.id)}
                    revLimiting={revLimiting}
                    onSelect={selectWidget}
                    onShiftSelect={toggleWidgetSelection}
                    onDragStart={handleDragStart}
                  />
                ))}

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
