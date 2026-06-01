// useDragState.ts — Mouse drag-to-move for the Canvas editor.
//
// Encapsulates the entire drag loop: mousedown snapshot, mousemove tick with
// snap-to-grid, mouseup commit (with collision resolution for single drags or
// a multi-widget commit for selections). State is kept in a `useRef` so the
// 60 Hz mousemove tick never schedules a React render — the previous
// implementation used a module-level `let` for the same reason; the ref keeps
// that property while letting each Canvas mount own its own loop.

import { useCallback, useRef, type MouseEvent as ReactMouseEvent, type RefObject } from 'react'
import type { Widget } from '@tmbk/canshift-core'
import { useDashboardStore } from '../stores/dashboard.store'

// Snap grid in firmware pixels — match the firmware's minimum token dimensions.
// X_SNAP = 40 px wide (narrowest visible column), Y_SNAP = 28 px tall.
const X_SNAP = 40
const Y_SNAP = 28

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

export interface DragInputs {
  pageId: string
  pageWidgets: readonly Widget[]
  selectedWidgetIds: readonly string[]
  /** Widget-area width in firmware pixels (target screen profile width). */
  canvasW: number
  /** Widget-area height in firmware pixels (target screen profile height minus top bar). */
  widgetAreaH: number
}

export interface UseDragStateOptions {
  /** Ref snapshot of the values consumed inside drag callbacks. The hook
   *  reads from `.current` at mousedown time so the mouse handlers stay
   *  ref-stable across renders. */
  dragInputsRef: RefObject<DragInputs>
  /** Live zoom factor; multiplied with `scale` to compute the screen → firmware-px ratio. */
  zoomRef: RefObject<number>
  /** Display scale factor (e.g. 1.5 for the studio 320×240 preview). */
  scale: number
}

/**
 * Returns the `onMouseDown` handler that a widget should call to begin a drag.
 * The hook attaches its own `mousemove` / `mouseup` window listeners and tears
 * them down on commit, so callers never have to wire anything else.
 */
export function useDragState({
  dragInputsRef,
  zoomRef,
  scale,
}: UseDragStateOptions): (e: ReactMouseEvent, widget: Widget) => void {
  const moveWidget = useDashboardStore((s) => s.moveWidget)
  const moveWidgets = useDashboardStore((s) => s.moveWidgets)
  const resolveWidgetCollisions = useDashboardStore((s) => s.resolveWidgetCollisions)
  const commitDrag = useDashboardStore((s) => s.commitDrag)

  // Per-mount ref instead of a module-level `let` — same no-render guarantee
  // (refs never schedule renders) but each Canvas mount owns its loop.
  const dragRef = useRef<DragState | null>(null)

  return useCallback(
    (e: ReactMouseEvent, widget: Widget) => {
      const inputs = dragInputsRef.current
      if (!inputs) return
      const { pageId, pageWidgets, selectedWidgetIds, canvasW, widgetAreaH } = inputs

      // Gather all widgets to drag: if the widget is part of multi-selection, drag all.
      // Otherwise drag only this widget (and set it as sole selection).
      const isMulti = selectedWidgetIds.length > 1 && selectedWidgetIds.includes(widget.id)

      const dragging: DraggingWidget[] = isMulti
        ? pageWidgets
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

      dragRef.current = {
        primaryId: widget.id,
        pageId,
        startMouseX: e.clientX,
        startMouseY: e.clientY,
        widgets: dragging,
        isMulti,
      }

      const handleMouseMove = (ev: MouseEvent) => {
        const drag = dragRef.current
        if (!drag) return
        const effectiveScale = scale * (zoomRef.current ?? 1)
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
              x: Math.max(0, Math.min(canvasW - dw.w, snappedX)),
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
          const newX = Math.max(0, Math.min(canvasW - dw.w, snappedX))
          const newY = Math.max(0, Math.min(widgetAreaH - dw.h, snappedY))
          moveWidget(drag.pageId, drag.primaryId, { x: newX, y: newY })
        }
      }

      const handleMouseUp = () => {
        const drag = dragRef.current
        if (drag) {
          if (drag.isMulti) {
            commitDrag()
          } else {
            resolveWidgetCollisions(drag.pageId, drag.primaryId)
          }
        }
        dragRef.current = null
        window.removeEventListener('mousemove', handleMouseMove)
        window.removeEventListener('mouseup', handleMouseUp)
      }

      window.addEventListener('mousemove', handleMouseMove)
      window.addEventListener('mouseup', handleMouseUp)
    },
    [dragInputsRef, zoomRef, scale, moveWidget, moveWidgets, resolveWidgetCollisions, commitDrag]
  )
}
