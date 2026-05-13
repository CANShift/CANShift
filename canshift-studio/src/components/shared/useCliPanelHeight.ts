// useCliPanelHeight.ts — Persisted height for the CLI panel (issue #378, PR 3).
//
// The bottom CLI panel previously had a fixed height. To make the terminal
// usable on tall displays — and to let users shrink it on small laptops — we
// expose a draggable handle on the top edge that updates this hook's value.
//
// The height is persisted to localStorage so the user's choice survives a
// reload (mirrors the pattern used by `cliSettings.store` before it was
// retired and by `log.store` for the verbose flag).

import { useCallback, useEffect, useRef, useState } from 'react'

const STORAGE_KEY = 'canshift.cli.panelHeight'
const STORAGE_KEY_COLLAPSED = 'canshift.cli.panelCollapsed'

export const CLI_PANEL_MIN_HEIGHT = 120
export const CLI_PANEL_DEFAULT_HEIGHT = 240
const CLI_PANEL_MAX_RATIO = 0.7

function clampToWindow(value: number): number {
  if (typeof window === 'undefined') {
    return Math.max(CLI_PANEL_MIN_HEIGHT, value)
  }
  const max = Math.max(CLI_PANEL_MIN_HEIGHT, Math.floor(window.innerHeight * CLI_PANEL_MAX_RATIO))
  return Math.min(Math.max(CLI_PANEL_MIN_HEIGHT, value), max)
}

function readInitial(): number {
  if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') {
    return CLI_PANEL_DEFAULT_HEIGHT
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (raw === null) return CLI_PANEL_DEFAULT_HEIGHT
    const parsed = Number.parseInt(raw, 10)
    if (!Number.isFinite(parsed)) return CLI_PANEL_DEFAULT_HEIGHT
    return clampToWindow(parsed)
  } catch {
    return CLI_PANEL_DEFAULT_HEIGHT
  }
}

function persist(value: number): void {
  if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') {
    return
  }
  try {
    window.localStorage.setItem(STORAGE_KEY, String(value))
  } catch {
    // Storage may be unavailable (private mode, quota). The in-memory value
    // still drives the current session — fine to swallow.
  }
}

function readCollapsed(): boolean {
  if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') return false
  try {
    return window.localStorage.getItem(STORAGE_KEY_COLLAPSED) === 'true'
  } catch {
    return false
  }
}

function persistCollapsed(value: boolean): void {
  if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') return
  try {
    window.localStorage.setItem(STORAGE_KEY_COLLAPSED, String(value))
  } catch {
    // Storage unavailable; in-memory state still drives the session.
  }
}

export interface CliPanelResize {
  height: number
  beginDrag: (event: React.MouseEvent<HTMLElement>) => void
  isDragging: boolean
  collapsed: boolean
  toggleCollapse: () => void
}

export function useCliPanelHeight(): CliPanelResize {
  const [height, setHeight] = useState<number>(readInitial)
  const [isDragging, setIsDragging] = useState<boolean>(false)
  const [collapsed, setCollapsed] = useState<boolean>(readCollapsed)
  const dragStartRef = useRef<{ y: number; height: number } | null>(null)

  // Re-clamp on viewport shrink so a previously-saved height that now exceeds
  // 70 % of the window snaps back to a sane value.
  useEffect(() => {
    function handleResize(): void {
      setHeight((current) => clampToWindow(current))
    }
    window.addEventListener('resize', handleResize)
    return () => {
      window.removeEventListener('resize', handleResize)
    }
  }, [])

  useEffect(() => {
    if (!isDragging) return
    const start = dragStartRef.current
    if (start === null) return

    function handleMove(event: MouseEvent): void {
      if (start === null) return
      const delta = start.y - event.clientY
      const next = clampToWindow(start.height + delta)
      setHeight(next)
    }

    function handleUp(): void {
      setIsDragging(false)
      dragStartRef.current = null
    }

    window.addEventListener('mousemove', handleMove)
    window.addEventListener('mouseup', handleUp)
    document.body.style.cursor = 'row-resize'
    document.body.style.userSelect = 'none'

    return () => {
      window.removeEventListener('mousemove', handleMove)
      window.removeEventListener('mouseup', handleUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
  }, [isDragging])

  // Persist after the user releases the handle, not on every pixel.
  useEffect(() => {
    if (isDragging) return
    persist(height)
  }, [isDragging, height])

  const beginDrag = useCallback(
    (event: React.MouseEvent<HTMLElement>): void => {
      event.preventDefault()
      dragStartRef.current = { y: event.clientY, height }
      setIsDragging(true)
    },
    [height]
  )

  const toggleCollapse = useCallback((): void => {
    setCollapsed((prev) => {
      const next = !prev
      persistCollapsed(next)
      return next
    })
  }, [])

  return { height, beginDrag, isDragging, collapsed, toggleCollapse }
}
