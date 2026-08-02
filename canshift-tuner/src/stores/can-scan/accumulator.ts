export const RATE_WINDOW_MS = 1_000
export const MAX_PAYLOAD_BYTES = 8

export interface CanFrame {
  id: number
  len: number
  data: number[]
}

export interface CanFrameStats {
  id: number
  firstSeenMs: number
  lastSeenMs: number
  count: number
  rateHz: number
  lastDlc: number
  lastPayload: readonly number[]
  byteValueCounts: ReadonlyArray<ReadonlyMap<number, number>>
}

export interface CanScanSnapshot {
  startedAt: number | null
  totalFrames: number
  totalRate: number
  frames: ReadonlyMap<number, CanFrameStats>
}

interface MutableFrameStats {
  id: number
  firstSeenMs: number
  lastSeenMs: number
  count: number
  recentMs: number[]
  lastDlc: number
  lastPayload: number[]
  byteValueCounts: Map<number, number>[]
}

export interface ScanAccumulator {
  ingest: (frame: CanFrame, nowMs: number) => void
  snapshot: (nowMs: number) => CanScanSnapshot
  markStarted: (nowMs: number) => void
  totalFrames: () => number
  reset: () => void
}

export const emptySnapshot = (): CanScanSnapshot => ({
  startedAt: null,
  totalFrames: 0,
  totalRate: 0,
  frames: new Map(),
})

export const createScanAccumulator = (): ScanAccumulator => {
  let frames = new Map<number, MutableFrameStats>()
  let total = 0
  let totalRecent: number[] = []
  let startedAt: number | null = null

  const trimRecent = (recent: number[], nowMs: number) => {
    while (recent.length > 0 && nowMs - (recent[0] ?? 0) > RATE_WINDOW_MS) {
      recent.shift()
    }
  }

  return {
    ingest: (frame, nowMs) => {
      total += 1
      totalRecent.push(nowMs)

      let stats = frames.get(frame.id)
      if (!stats) {
        stats = {
          id: frame.id,
          firstSeenMs: nowMs,
          lastSeenMs: nowMs,
          count: 0,
          recentMs: [],
          lastDlc: frame.len,
          lastPayload: [],
          byteValueCounts: Array.from(
            { length: MAX_PAYLOAD_BYTES },
            () => new Map<number, number>()
          ),
        }
        frames.set(frame.id, stats)
      }
      stats.count += 1
      stats.lastSeenMs = nowMs
      stats.lastDlc = frame.len
      stats.lastPayload = frame.data.slice(0, MAX_PAYLOAD_BYTES)
      stats.recentMs.push(nowMs)
      for (let i = 0; i < frame.data.length && i < MAX_PAYLOAD_BYTES; i++) {
        const byte = frame.data[i]
        if (byte === undefined) continue
        const counts = stats.byteValueCounts[i]
        if (!counts) continue
        counts.set(byte, (counts.get(byte) ?? 0) + 1)
      }
    },

    snapshot: (nowMs) => {
      trimRecent(totalRecent, nowMs)
      const next = new Map<number, CanFrameStats>()
      for (const [id, m] of frames) {
        trimRecent(m.recentMs, nowMs)
        next.set(id, {
          id: m.id,
          firstSeenMs: m.firstSeenMs,
          lastSeenMs: m.lastSeenMs,
          count: m.count,
          rateHz: m.recentMs.length,
          lastDlc: m.lastDlc,
          lastPayload: m.lastPayload.slice(),
          byteValueCounts: m.byteValueCounts.map((counts) => new Map(counts)),
        })
      }
      return { startedAt, totalFrames: total, totalRate: totalRecent.length, frames: next }
    },

    markStarted: (nowMs) => {
      startedAt = nowMs
    },

    totalFrames: () => total,

    reset: () => {
      frames = new Map()
      total = 0
      totalRecent = []
      startedAt = null
    },
  }
}
