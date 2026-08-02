import { memo, type DragEvent, type MouseEvent } from 'react'
import type { PagePalette, Widget } from '@tmbk/canshift-core'
import { resolveGridRect } from '@tmbk/canshift-core'
import { WidgetPreview } from './WidgetPreview'
import { SIGNAL_CONSUMING_TYPES, SIGNAL_DRAG_MIME } from '../../utils/default-widget'

export interface WidgetBoxProps {
  widget: Widget
  palette: PagePalette
  scale: number
  areaWidth: number
  areaHeight: number
  isSelected: boolean
  isInMultiSelection: boolean
  isOverlapping: boolean
  isOverflowing: boolean
  isFlashing: boolean
  revLimiting: boolean
  onSelect: (id: string) => void
  onShiftSelect: (id: string) => void
  onDragStart: (e: MouseEvent, widget: Widget) => void
  onSignalDrop: (widget: Widget, signalName: string) => void
}

export const WidgetBox = memo(function WidgetBox({
  widget,
  palette,
  scale,
  areaWidth,
  areaHeight,
  isSelected,
  isInMultiSelection,
  isOverlapping,
  isOverflowing,
  isFlashing,
  revLimiting,
  onSelect,
  onShiftSelect,
  onDragStart,
  onSignalDrop,
}: WidgetBoxProps) {
  const acceptsSignal = SIGNAL_CONSUMING_TYPES.has(widget.type)
  const { layout } = widget
  const rect = resolveGridRect(layout, { width: areaWidth, height: areaHeight })
  const displayW = rect.w * scale
  const displayH = rect.h * scale
  const bgColor = isOverlapping
    ? '#2A0000'
    : isOverflowing
      ? '#2A1A00'
      : isSelected
        ? 'hsl(var(--selection-bg))'
        : isInMultiSelection
          ? '#0A0A1E'
          : '#000000'

  return (
    <div
      data-widget="true"
      role="button"
      tabIndex={0}
      aria-label={`${widget.type} widget at column ${String(layout.col)}, row ${String(layout.row)}`}
      aria-pressed={isSelected}
      title={isOverflowing ? 'Widget spans past the 12-column grid' : undefined}
      onFocus={() => {
        if (!isSelected) onSelect(widget.id)
      }}
      onMouseDown={(e) => {
        e.stopPropagation()
        if (e.shiftKey) {
          onShiftSelect(widget.id)
        } else {
          onSelect(widget.id)
          onDragStart(e, widget)
        }
      }}
      onDragOver={(e: DragEvent) => {
        if (!acceptsSignal || !e.dataTransfer.types.includes(SIGNAL_DRAG_MIME)) return
        e.preventDefault()
        e.stopPropagation()
        e.dataTransfer.dropEffect = 'link'
      }}
      onDrop={(e: DragEvent) => {
        const name = e.dataTransfer.getData(SIGNAL_DRAG_MIME)
        if (!acceptsSignal || !name) return
        e.preventDefault()
        e.stopPropagation()
        onSignalDrop(widget, name)
      }}
      className={isFlashing ? 'widget-rebind-flash' : undefined}
      style={{
        position: 'absolute',
        left: rect.x * scale,
        top: rect.y * scale,
        width: displayW,
        height: displayH,
        background: bgColor,
        boxSizing: 'border-box',
        cursor: 'move',
        overflow: 'hidden',
        userSelect: 'none',
        outline: isFlashing
          ? '2px solid hsl(var(--brand-accent))'
          : isSelected
            ? '2px solid hsl(var(--selection))'
            : undefined,
        outlineOffset: isFlashing ? -2 : isSelected ? -2 : undefined,
        boxShadow: isOverlapping
          ? '0 0 0 1px #FF222244, 0 0 8px #FF222288'
          : isOverflowing
            ? '0 0 0 1px #FF880044, 0 0 8px #FF880088'
            : isInMultiSelection
              ? '0 0 0 1px #AAAAFF22, 0 0 4px #AAAAFF44'
              : undefined,
      }}
    >
      <WidgetPreview
        widget={widget}
        palette={palette}
        displayW={displayW}
        displayH={displayH}
        revLimiting={revLimiting}
      />
    </div>
  )
})
