// WidgetBox.tsx — Single widget container rendered on the Canvas grid.
// Owns selection / drag affordance chrome and delegates the visual to
// `WidgetPreview`. Pure presentation: every interaction is forwarded to
// the parent through `onSelect` / `onShiftSelect` / `onDragStart`.

import { memo, type MouseEvent } from 'react'
import type { PagePalette, Widget } from '@tmbk/canshift-core'
import { WidgetPreview } from './WidgetPreview'

export interface WidgetBoxProps {
  widget: Widget
  palette: PagePalette
  /** Display scale factor — multiplies firmware-pixel layout to canvas pixels. */
  scale: number
  isSelected: boolean
  isInMultiSelection: boolean
  isOverlapping: boolean
  /**
   * Widget extends past the active target-screen profile bounds (issue #548).
   * Surfaces a distinct orange chrome (vs. red overlap) so users see the
   * out-of-bounds state and fix it manually — studio never auto-clamps.
   */
  isOverflowing: boolean
  revLimiting: boolean
  onSelect: (id: string) => void
  onShiftSelect: (id: string) => void
  onDragStart: (e: MouseEvent, widget: Widget) => void
}

// Memoized so dragging one widget doesn't re-render every other widget on the
// page. Since the parent passes stable handler refs (useCallback) and immer
// keeps unchanged widget refs identical across store updates, default shallow
// comparison is correct here — only the moved widget's `widget` prop changes.
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
  // Default to black so the widget container blends with the (black) page
  // background — firmware widgets render directly on the page bg with no
  // per-widget surface tint (issue #143). Selection / overlap / overflow states
  // tint the bg so the highlight is visible even when the underlying widget
  // chrome is dark; the outline ring below adds an unmistakable selection edge.
  // Overlap (red) takes precedence over overflow (orange) — both are problems,
  // but two widgets stacked is harder to spot at a glance than a single widget
  // bleeding off the canvas edge.
  const bgColor = isOverlapping
    ? '#2A0000'
    : isOverflowing
      ? '#2A1A00'
      : isSelected
        ? '#1B2030'
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
        // No solid border (matches the borderless firmware render). Selection
        // pops via outline (doesn't shift layout) + bgColor tint. Overlap and
        // multi-select keep their boxShadow rings for affordance contrast.
        outline: isSelected ? '2px solid #6CB6FF' : undefined,
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
