import { useCallback, useRef, useState, type RefObject } from 'react'
import { useDashboardStore } from '../stores/dashboard.store'
import { rectsOverlap } from '../utils/layout'

export const RB_THRESHOLD = 4

export interface RubberBand {
  x: number
  y: number
  w: number
  h: number
}

export interface UseRubberBandSelectionOptions {
  containerRef: RefObject<HTMLDivElement | null>
  effScale: number
  pageId: string
  selectWidgets: (widgetIds: string[]) => void
}

export interface UseRubberBandSelectionResult {
  rubberBand: RubberBand | null
  startRubberBand: (e: React.PointerEvent) => void
}

export const useRubberBandSelection = ({
  containerRef,
  effScale,
  pageId,
  selectWidgets,
}: UseRubberBandSelectionOptions): UseRubberBandSelectionResult => {
  const rubberBandRef = useRef<{ startFwX: number; startFwY: number } | null>(null)
  const [rubberBand, setRubberBand] = useState<RubberBand | null>(null)

  const startRubberBand = useCallback(
    (e: React.PointerEvent) => {
      if (!containerRef.current) return
      const cr = containerRef.current.getBoundingClientRect()
      const startFwX = (e.clientX - cr.left) / effScale
      const startFwY = (e.clientY - cr.top) / effScale
      rubberBandRef.current = { startFwX, startFwY }

      const handleMove = (ev: MouseEvent) => {
        if (!rubberBandRef.current || !containerRef.current) return
        const r = containerRef.current.getBoundingClientRect()
        const curFwX = (ev.clientX - r.left) / effScale
        const curFwY = (ev.clientY - r.top) / effScale
        const { startFwX: sx, startFwY: sy } = rubberBandRef.current
        setRubberBand({
          x: Math.min(sx, curFwX),
          y: Math.min(sy, curFwY),
          w: Math.abs(curFwX - sx),
          h: Math.abs(curFwY - sy),
        })
      }

      const capturedPageId = pageId

      const handleUp = (ev: MouseEvent) => {
        document.removeEventListener('mousemove', handleMove)
        document.removeEventListener('mouseup', handleUp)

        if (!rubberBandRef.current || !containerRef.current) {
          rubberBandRef.current = null
          setRubberBand(null)
          return
        }

        const r = containerRef.current.getBoundingClientRect()
        const curFwX = (ev.clientX - r.left) / effScale
        const curFwY = (ev.clientY - r.top) / effScale
        const { startFwX: sx, startFwY: sy } = rubberBandRef.current
        const rbX = Math.min(sx, curFwX)
        const rbY = Math.min(sy, curFwY)
        const rbW = Math.abs(curFwX - sx)
        const rbH = Math.abs(curFwY - sy)

        rubberBandRef.current = null
        setRubberBand(null)

        if (rbW > RB_THRESHOLD || rbH > RB_THRESHOLD) {
          const widgets =
            useDashboardStore.getState().config?.pages.find((p) => p.id === capturedPageId)
              ?.widgets ?? []
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
        }
      }

      document.addEventListener('mousemove', handleMove)
      document.addEventListener('mouseup', handleUp)
    },
    [containerRef, pageId, selectWidgets, effScale]
  )

  return { rubberBand, startRubberBand }
}
