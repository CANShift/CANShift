import { useEffect, useMemo, useRef } from 'react'
import { TelemetrySample, getRange, getWriteIndex } from '../stores/telemetry.store'
import { useGraphTick } from './use-graph-tick'

const SEED_SAMPLE_COUNT = 3000

export const ingestIncremental = (
  rolling: TelemetrySample[],
  freshSamples: readonly TelemetrySample[],
  windowStart: number
): number => {
  if (freshSamples.length > 0) {
    for (const s of freshSamples) rolling.push(s)
  }
  let drop = 0
  while (drop < rolling.length) {
    const head = rolling[drop]
    if (head === undefined || head.t >= windowStart) break
    drop++
  }
  if (drop > 0) rolling.splice(0, drop)
  return drop
}

export interface GraphSeries {
  rolling: readonly TelemetrySample[]
  windowStart: number
  windowEnd: number
  hasData: boolean
}

export const useGraphSeries = (
  windowSecs: number,
  paused: boolean,
  pausedAt: number
): GraphSeries => {
  const tick = useGraphTick(paused)
  const rollingRef = useRef<TelemetrySample[]>([])
  const lastSeenIndexRef = useRef<number>(0)

  useEffect(() => {
    const writeIdx = getWriteIndex()
    const fromIdx = Math.max(0, writeIdx - SEED_SAMPLE_COUNT)
    rollingRef.current = [...getRange(fromIdx, writeIdx)]
    lastSeenIndexRef.current = writeIdx
  }, [windowSecs])

  return useMemo(() => {
    const now = paused ? pausedAt : Date.now()
    const windowStart = now - windowSecs * 1000

    const currentWriteIndex = getWriteIndex()
    if (currentWriteIndex < lastSeenIndexRef.current) {
      rollingRef.current = []
      lastSeenIndexRef.current = 0
    }
    const fresh =
      currentWriteIndex > lastSeenIndexRef.current
        ? getRange(lastSeenIndexRef.current, currentWriteIndex)
        : []
    lastSeenIndexRef.current = currentWriteIndex

    const rolling = rollingRef.current
    ingestIncremental(rolling, fresh, windowStart)

    return { rolling, windowStart, windowEnd: now, hasData: rolling.length > 1 }
  }, [tick, windowSecs, paused, pausedAt])
}
