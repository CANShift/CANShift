// canScanner.store.ts — State for the CAN bus signal scanner.
//
// Keeps a live table of discovered CAN frame IDs.
// Each entry tracks the last seen bytes, total frame count, and receive rate.
// Rate is computed as frames per second averaged over the last 2s window.

import { create } from 'zustand'
import type { CanFrame } from '../services/ipc.service'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CanFrameEntry {
  /** Raw CAN identifier (11-bit standard or 29-bit extended) */
  id: number
  /** Data length code: 0–8 */
  dlc: number
  /** Last received byte payload */
  data: number[]
  /** Total frames received for this ID since scan started */
  count: number
  /** Epoch ms of first received frame */
  firstSeen: number
  /** Epoch ms of last received frame */
  lastSeen: number
  /** Frames per second (rolling 2s average) */
  rate: number
}

interface CanScannerState {
  scanning: boolean
  frames: Record<number, CanFrameEntry>

  setScanningState: (scanning: boolean) => void
  ingestBatch: (batch: CanFrame[]) => void
  clearFrames: () => void
}

// ---------------------------------------------------------------------------
// Rate tracking helpers
// ---------------------------------------------------------------------------

// Ring buffer of recent frame timestamps per ID (up to RATE_WINDOW_MS lookback)
const RATE_WINDOW_MS = 2_000
const frameTimes = new Map<number, number[]>()

function computeRate(id: number, nowMs: number): number {
  const times = frameTimes.get(id) ?? []
  const cutoff = nowMs - RATE_WINDOW_MS
  const recent = times.filter((t) => t >= cutoff)
  frameTimes.set(id, recent)
  return Math.round((recent.length / (RATE_WINDOW_MS / 1_000)) * 10) / 10
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useCanScannerStore = create<CanScannerState>((set) => ({
  scanning: false,
  frames: {},

  setScanningState: (scanning) => {
    set({ scanning })
  },

  ingestBatch: (batch) => {
    if (batch.length === 0) return
    const now = Date.now()

    set((state) => {
      const next = { ...state.frames }

      for (const frame of batch) {
        // Append timestamp to ring buffer
        const times = frameTimes.get(frame.id) ?? []
        times.push(now)
        frameTimes.set(frame.id, times)

        const existing = next[frame.id]
        if (existing) {
          next[frame.id] = {
            ...existing,
            dlc: frame.len,
            data: frame.data,
            count: existing.count + 1,
            lastSeen: now,
            rate: computeRate(frame.id, now),
          }
        } else {
          next[frame.id] = {
            id: frame.id,
            dlc: frame.len,
            data: frame.data,
            count: 1,
            firstSeen: now,
            lastSeen: now,
            rate: computeRate(frame.id, now),
          }
        }
      }

      return { frames: next }
    })
  },

  clearFrames: () => {
    frameTimes.clear()
    set({ frames: {} })
  },
}))
