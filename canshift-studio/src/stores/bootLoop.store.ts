// bootLoop.store.ts — Sliding-window detector for device boot loops (#498).
//
// `useBootLoopDetector` feeds boot-banner timestamps into `recordBootMarker`.
// When at least BOOT_LOOP_THRESHOLD markers land inside the trailing
// BOOT_LOOP_WINDOW_MS, the store flips `looping` true and `BootLoopBanner`
// surfaces a warning with the captured pre-boot context. Dismissing the banner
// suppresses that specific window — a fresh wave of restarts re-triggers it.

import { create } from 'zustand'

/** Number of `[BOOT]` banners within the window required to flag a loop. */
export const BOOT_LOOP_THRESHOLD = 3

/** Sliding-window length (ms) over which boot markers are counted. */
export const BOOT_LOOP_WINDOW_MS = 10_000

/** Idle period (ms) without further boot markers that clears the banner. */
export const QUIET_RESET_MS = 30_000

/** Maximum number of pre-boot context lines retained for the banner. */
export const CONTEXT_LINES = 30

export interface CapturedLine {
  level: string
  tag: string
  message: string
  timestampMs: number
}

interface BootLoopState {
  looping: boolean
  bootMarkers: number[]
  lastVersion: string | null
  lastBootContext: CapturedLine[]
  detectedAt: number | null
  dismissedAt: number | null

  recordBootMarker: (
    timestampMs: number,
    version: string,
    contextBefore: readonly CapturedLine[]
  ) => void
  reset: () => void
  dismissForSession: () => void
}

const INITIAL_STATE = {
  looping: false,
  bootMarkers: [] as number[],
  lastVersion: null as string | null,
  lastBootContext: [] as CapturedLine[],
  detectedAt: null as number | null,
} as const

export const useBootLoopStore = create<BootLoopState>()((set) => ({
  ...INITIAL_STATE,
  dismissedAt: null,

  recordBootMarker: (timestampMs, version, contextBefore) => {
    set((state) => {
      const cutoff = timestampMs - BOOT_LOOP_WINDOW_MS
      const pruned = [...state.bootMarkers.filter((t) => t >= cutoff), timestampMs]
      const trimmedContext = contextBefore.slice(-CONTEXT_LINES)

      // The window is "fresh" relative to a prior dismissal when the oldest
      // surviving marker post-dates the dismissal — otherwise the user already
      // told us to stay quiet about this exact loop.
      const firstInWindow = pruned[0] ?? timestampMs
      const dismissalIsStale = state.dismissedAt === null || state.dismissedAt < firstInWindow

      const shouldFlag = pruned.length >= BOOT_LOOP_THRESHOLD && dismissalIsStale

      return {
        bootMarkers: pruned,
        lastVersion: version,
        lastBootContext: trimmedContext,
        looping: shouldFlag ? true : state.looping,
        detectedAt: shouldFlag && !state.looping ? timestampMs : state.detectedAt,
      }
    })
  },

  reset: () => {
    set({ ...INITIAL_STATE })
  },

  dismissForSession: () => {
    set({ looping: false, dismissedAt: Date.now() })
  },
}))
