import { useRef, type Dispatch, type RefObject, type SetStateAction } from 'react'
import type { PageConfig } from '@tmbk/canshift-core'
import { RB_THRESHOLD, type RubberBand } from './useRubberBandSelection'

export interface UseSwipeGesturesOptions {
  containerRef: RefObject<HTMLDivElement | null>
  pageId: string
  pages: readonly PageConfig[]
  rubberBand: RubberBand | null
  diagOpen: boolean
  settingsOpen: boolean
  setDiagOpen: Dispatch<SetStateAction<boolean>>
  selectWidget: (widgetId: string | null) => void
  selectPage: (pageId: string | null) => void
  startRubberBand: (e: React.PointerEvent) => void
}

export interface UseSwipeGesturesResult {
  onPointerDown: (e: React.PointerEvent) => void
  onPointerUp: (e: React.PointerEvent) => void
}

export const useSwipeGestures = ({
  containerRef,
  pageId,
  pages,
  rubberBand,
  diagOpen,
  settingsOpen,
  setDiagOpen,
  selectWidget,
  selectPage,
  startRubberBand,
}: UseSwipeGesturesOptions): UseSwipeGesturesResult => {
  const swipeRef = useRef<{ startX: number; startY: number } | null>(null)

  const onPointerDown = (e: React.PointerEvent) => {
    const target = e.target as HTMLElement
    const isBackground = target === containerRef.current || target.closest('[data-widget]') === null
    if (!isBackground) return
    swipeRef.current = { startX: e.clientX, startY: e.clientY }
    selectWidget(null)
    startRubberBand(e)
  }

  const onPointerUp = (e: React.PointerEvent) => {
    if (rubberBand && (rubberBand.w > RB_THRESHOLD || rubberBand.h > RB_THRESHOLD)) {
      swipeRef.current = null
      return
    }
    if (!swipeRef.current) return
    const dx = e.clientX - swipeRef.current.startX
    const dy = e.clientY - swipeRef.current.startY
    swipeRef.current = null

    if (Math.abs(dy) > 28) {
      if (dy < 0 && !diagOpen && !settingsOpen) setDiagOpen(true)
      if (dy > 0 && diagOpen) setDiagOpen(false)
      return
    }

    if (diagOpen || settingsOpen) return
    if (Math.abs(dy) > 20 || Math.abs(dx) < 40) return
    const currentIdx = pages.findIndex((p) => p.id === pageId)
    const nextIdx = dx < 0 ? currentIdx + 1 : currentIdx - 1
    const nextPage = pages[nextIdx]
    if (nextPage) selectPage(nextPage.id)
  }

  return { onPointerDown, onPointerUp }
}
