import { useCallback, useRef, useState, type RefObject } from 'react'
import type { GridRect } from '@tmbk/canshift-core'
import { resolveGridRect, resolveScreenProfile } from '@tmbk/canshift-core'
import { useDashboardStore } from '../stores/dashboard.store'

export const RB_THRESHOLD = 4

const rectsIntersect = (a: GridRect, b: GridRect): boolean =>
  a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y

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
          const config = useDashboardStore.getState().config
          const page = config?.pages.find((p) => p.id === capturedPageId)
          if (config && page) {
            const profile = resolveScreenProfile(config.targetProfile)
            const areaHeight =
              page.showTopBar !== false ? profile.height - config.topBar.height : profile.height
            const area = { width: profile.width, height: areaHeight }
            const rb: GridRect = { x: rbX, y: rbY, w: rbW, h: rbH }
            const ids = page.widgets
              .filter((w) => rectsIntersect(rb, resolveGridRect(w.layout, area)))
              .map((w) => w.id)
            if (ids.length > 0) selectWidgets(ids)
          }
        }
      }

      document.addEventListener('mousemove', handleMove)
      document.addEventListener('mouseup', handleUp)
    },
    [containerRef, pageId, selectWidgets, effScale]
  )

  return { rubberBand, startRubberBand }
}
