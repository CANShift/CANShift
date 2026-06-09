import { useCallback, useEffect, useRef, useState } from 'react'
import { canScannerIpc, deviceEvents } from '../transport'
import { useDeviceStore } from '../stores/device.store'
import { useLogStore } from '../stores/log.store'

const SNAPSHOT_INTERVAL_MS = 250
const RATE_WINDOW_MS = 1_000
const MAX_PAYLOAD_BYTES = 8

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

export interface CanScannerSnapshot {
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

export type CanScannerStatus = 'idle' | 'starting' | 'running' | 'stopping' | 'error'

export interface UseCanScanner {
  status: CanScannerStatus
  error: string | null
  snapshot: CanScannerSnapshot
  start: () => Promise<void>
  stop: () => Promise<void>
  reset: () => void
}

export function useCanScanner(): UseCanScanner {
  const connected = useDeviceStore((s) => s.connected)
  const simulationMode = useDeviceStore((s) => s.simulationMode)
  const log = useLogStore((s) => s.push)

  const framesRef = useRef<Map<number, MutableFrameStats>>(new Map())
  const totalFramesRef = useRef(0)
  const totalRecentRef = useRef<number[]>([])
  const startedAtRef = useRef<number | null>(null)
  const subscriptionRef = useRef<(() => void) | null>(null)

  const [status, setStatus] = useState<CanScannerStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  const [snapshot, setSnapshot] = useState<CanScannerSnapshot>({
    startedAt: null,
    totalFrames: 0,
    totalRate: 0,
    frames: new Map(),
  })

  const clear = useCallback(() => {
    framesRef.current = new Map()
    totalFramesRef.current = 0
    totalRecentRef.current = []
    startedAtRef.current = null
    setSnapshot({ startedAt: null, totalFrames: 0, totalRate: 0, frames: new Map() })
  }, [])

  const handleFrame = useCallback((frame: { id: number; len: number; data: number[] }) => {
    const now = performance.now()
    totalFramesRef.current += 1
    totalRecentRef.current.push(now)

    let stats = framesRef.current.get(frame.id)
    if (!stats) {
      stats = {
        id: frame.id,
        firstSeenMs: now,
        lastSeenMs: now,
        count: 0,
        recentMs: [],
        lastDlc: frame.len,
        lastPayload: [],
        byteValueCounts: Array.from({ length: MAX_PAYLOAD_BYTES }, () => new Map<number, number>()),
      }
      framesRef.current.set(frame.id, stats)
    }
    stats.count += 1
    stats.lastSeenMs = now
    stats.lastDlc = frame.len
    stats.lastPayload = frame.data.slice(0, MAX_PAYLOAD_BYTES)
    stats.recentMs.push(now)
    for (let i = 0; i < frame.data.length && i < MAX_PAYLOAD_BYTES; i++) {
      const byte = frame.data[i]
      if (byte === undefined) continue
      const counts = stats.byteValueCounts[i]
      if (!counts) continue
      counts.set(byte, (counts.get(byte) ?? 0) + 1)
    }
  }, [])

  const start = useCallback(async () => {
    if (!connected || simulationMode) return
    if (status === 'running' || status === 'starting') return
    setStatus('starting')
    setError(null)
    clear()
    const result = await canScannerIpc.start()
    if (!result.success) {
      const err = result.error ?? 'unknown_error'
      setStatus('error')
      setError(err)
      log('error', `CAN scan start failed: ${err}`)
      return
    }
    startedAtRef.current = performance.now()
    subscriptionRef.current = deviceEvents.onCanFrame(handleFrame)
    setStatus('running')
    log('info', 'CAN scan started')
  }, [connected, simulationMode, status, clear, handleFrame, log])

  const stop = useCallback(async () => {
    if (status === 'idle' || status === 'stopping') return
    setStatus('stopping')
    if (subscriptionRef.current) {
      subscriptionRef.current()
      subscriptionRef.current = null
    }
    const result = await canScannerIpc.stop()
    if (!result.success) {
      const err = result.error ?? 'unknown_error'
      log('warn', `CAN scan stop failed: ${err}`)
    }
    setStatus('idle')
    log('info', `CAN scan stopped — ${String(totalFramesRef.current)} frames captured`)
  }, [status, log])

  useEffect(() => {
    if (status !== 'running') return
    const id = window.setInterval(() => {
      const now = performance.now()
      while (totalRecentRef.current.length > 0 && now - (totalRecentRef.current[0] ?? 0) > RATE_WINDOW_MS) {
        totalRecentRef.current.shift()
      }
      const totalRate = totalRecentRef.current.length

      const next = new Map<number, CanFrameStats>()
      for (const [id, m] of framesRef.current) {
        while (m.recentMs.length > 0 && now - (m.recentMs[0] ?? 0) > RATE_WINDOW_MS) {
          m.recentMs.shift()
        }
        const byteCounts = m.byteValueCounts.map((counts) => new Map(counts))
        next.set(id, {
          id: m.id,
          firstSeenMs: m.firstSeenMs,
          lastSeenMs: m.lastSeenMs,
          count: m.count,
          rateHz: m.recentMs.length,
          lastDlc: m.lastDlc,
          lastPayload: m.lastPayload.slice(),
          byteValueCounts: byteCounts,
        })
      }
      setSnapshot({
        startedAt: startedAtRef.current,
        totalFrames: totalFramesRef.current,
        totalRate,
        frames: next,
      })
    }, SNAPSHOT_INTERVAL_MS)
    return () => {
      window.clearInterval(id)
    }
  }, [status])

  useEffect(() => {
    return () => {
      if (subscriptionRef.current) {
        subscriptionRef.current()
        subscriptionRef.current = null
      }
      if (status === 'running' || status === 'starting') {
        void canScannerIpc.stop()
      }
    }
  }, [status])

  useEffect(() => {
    if (!connected || simulationMode) {
      if (status === 'running') void stop()
    }
  }, [connected, simulationMode, status, stop])

  return { status, error, snapshot, start, stop, reset: clear }
}
