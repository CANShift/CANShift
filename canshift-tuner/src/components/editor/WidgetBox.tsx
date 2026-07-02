import { memo, type MouseEvent } from 'react'
import type { PagePalette, Widget } from '@tmbk/canshift-core'
import { WidgetPreview } from './WidgetPreview'

export interface WidgetBoxProps {
  widget: Widget
  palette: PagePalette
  scale: number
  isSelected: boolean
  isInMultiSelection: boolean
  isOverlapping: boolean
  isOverflowing: boolean
  revLimiting: boolean
  onSelect: (id: string) => void
  onShiftSelect: (id: string) => void
  onDragStart: (e: MouseEvent, widget: Widget) => void
}

export const WidgetBox = memo(function WidgetBox({
  widget,
  palette,
  scale,
  isSelected,
  isInMultiSelection,
  isOverlapping,
  isOverflowing,
  revLimiting,
  onSelect,
  onShiftSelect,
  onDragStart,
}: WidgetBoxProps) {
  const { layout } = widget
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
      title={isOverflowing ? 'Widget extends past the target screen bounds' : undefined}
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
        left: layout.x * scale,
        top: layout.y * scale,
        width: layout.w * scale,
        height: layout.h * scale,
        background: bgColor,
        borderRadius: 3,
        boxSizing: 'border-box',
        cursor: 'move',
        overflow: 'hidden',
        userSelect: 'none',
        outline: isSelected ? '2px solid hsl(var(--selection))' : undefined,
        outlineOffset: isSelected ? -2 : undefined,
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
        displayW={layout.w * scale}
        displayH={layout.h * scale}
        revLimiting={revLimiting}
      />
    </div>
  )
})
