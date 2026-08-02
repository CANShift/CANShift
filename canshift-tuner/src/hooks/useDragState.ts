import { useCallback, useRef, type MouseEvent as ReactMouseEvent, type RefObject } from 'react'
import type { Widget } from '@tmbk/canshift-core'
import { LAYOUT_GRID, clampGridPlacement } from '@tmbk/canshift-core'
import { useDashboardStore } from '../stores/dashboard.store'

interface DraggingWidget {
  id: string
  startCol: number
  startRow: number
  colSpan: number
  rowSpan: number
}

interface DragState {
  primaryId: string
  pageId: string
  startMouseX: number
  startMouseY: number
  widgets: DraggingWidget[]
  isMulti: boolean
  began: boolean
}

export interface DragInputs {
  pageId: string
  pageWidgets: readonly Widget[]
  selectedWidgetIds: readonly string[]
  canvasW: number
  widgetAreaH: number
}

export interface UseDragStateOptions {
  dragInputsRef: RefObject<DragInputs>
  zoomRef: RefObject<number>
  scale: number
}

const trackPitch = (areaSize: number, tracks: number): number =>
  (areaSize - 2 * LAYOUT_GRID.FRAME_PADDING + LAYOUT_GRID.GUTTER) / tracks

const clampGroupDelta = (
  raw: number,
  widgets: DraggingWidget[],
  start: (w: DraggingWidget) => number,
  span: (w: DraggingWidget) => number,
  tracks: number
): number => {
  const min = Math.max(...widgets.map((w) => -start(w)))
  const max = Math.min(...widgets.map((w) => tracks - span(w) - start(w)))
  return min > max ? raw : Math.min(Math.max(raw, min), max)
}

export const useDragState = ({
  dragInputsRef,
  zoomRef,
  scale,
}: UseDragStateOptions): ((e: ReactMouseEvent, widget: Widget) => void) => {
  const moveWidget = useDashboardStore((s) => s.moveWidget)
  const moveWidgets = useDashboardStore((s) => s.moveWidgets)
  const resolveWidgetCollisions = useDashboardStore((s) => s.resolveWidgetCollisions)
  const beginDrag = useDashboardStore((s) => s.beginDrag)

  const dragRef = useRef<DragState | null>(null)

  return useCallback(
    (e: ReactMouseEvent, widget: Widget) => {
      const inputs = dragInputsRef.current
      if (!inputs) return
      const { pageId, pageWidgets, selectedWidgetIds, canvasW, widgetAreaH } = inputs

      const isMulti = selectedWidgetIds.length > 1 && selectedWidgetIds.includes(widget.id)

      const dragging: DraggingWidget[] = isMulti
        ? pageWidgets
            .filter((w) => selectedWidgetIds.includes(w.id))
            .map((w) => ({
              id: w.id,
              startCol: w.layout.col,
              startRow: w.layout.row,
              colSpan: w.layout.colSpan,
              rowSpan: w.layout.rowSpan,
            }))
        : [
            {
              id: widget.id,
              startCol: widget.layout.col,
              startRow: widget.layout.row,
              colSpan: widget.layout.colSpan,
              rowSpan: widget.layout.rowSpan,
            },
          ]

      dragRef.current = {
        primaryId: widget.id,
        pageId,
        startMouseX: e.clientX,
        startMouseY: e.clientY,
        widgets: dragging,
        isMulti,
        began: false,
      }

      const colPitch = trackPitch(canvasW, LAYOUT_GRID.COLUMNS)
      const rowPitch = trackPitch(widgetAreaH, LAYOUT_GRID.ROWS)

      const handleMouseMove = (ev: MouseEvent) => {
        const drag = dragRef.current
        if (!drag) return
        const effectiveScale = scale * (zoomRef.current ?? 1)
        const rawDeltaCols = Math.round(
          (ev.clientX - drag.startMouseX) / (colPitch * effectiveScale)
        )
        const rawDeltaRows = Math.round(
          (ev.clientY - drag.startMouseY) / (rowPitch * effectiveScale)
        )
        const deltaCols = drag.isMulti
          ? clampGroupDelta(
              rawDeltaCols,
              drag.widgets,
              (w) => w.startCol,
              (w) => w.colSpan,
              LAYOUT_GRID.COLUMNS
            )
          : rawDeltaCols
        const deltaRows = drag.isMulti
          ? clampGroupDelta(
              rawDeltaRows,
              drag.widgets,
              (w) => w.startRow,
              (w) => w.rowSpan,
              LAYOUT_GRID.ROWS
            )
          : rawDeltaRows

        const place = (dw: DraggingWidget): { id: string; col: number; row: number } => {
          const clamped = clampGridPlacement({
            col: dw.startCol + deltaCols,
            colSpan: dw.colSpan,
            row: dw.startRow + deltaRows,
            rowSpan: dw.rowSpan,
          })
          return { id: dw.id, col: clamped.col, row: clamped.row }
        }

        const placed = drag.widgets.map(place)
        if (!drag.began) {
          const moved = placed.some((p, i) => {
            const dw = drag.widgets[i]
            return dw !== undefined && (p.col !== dw.startCol || p.row !== dw.startRow)
          })
          if (!moved) return
          drag.began = true
          beginDrag(
            drag.pageId,
            drag.widgets.map((w) => w.id)
          )
        }

        if (drag.isMulti) {
          moveWidgets(drag.pageId, placed)
        } else {
          const first = placed[0]
          if (!first) return
          moveWidget(drag.pageId, drag.primaryId, { col: first.col, row: first.row })
        }
      }

      const handleMouseUp = () => {
        const drag = dragRef.current
        if (drag?.began && !drag.isMulti) {
          resolveWidgetCollisions(drag.pageId, drag.primaryId)
        }
        dragRef.current = null
        window.removeEventListener('mousemove', handleMouseMove)
        window.removeEventListener('mouseup', handleMouseUp)
      }

      window.addEventListener('mousemove', handleMouseMove)
      window.addEventListener('mouseup', handleMouseUp)
    },
    [dragInputsRef, zoomRef, scale, moveWidget, moveWidgets, resolveWidgetCollisions, beginDrag]
  )
}
