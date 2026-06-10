import { TrackTelemetrySchema, type TrackTelemetry } from '@tmbk/canshift-core'
import { log } from '../stores/log.store'
import { useTrackSessionStore } from '../stores/track-session.store'
import { buildTrackTelemetry } from './track-telemetry'

export type TrackTelemetryWriter = (payload: TrackTelemetry) => Promise<void>

export interface TrackTelemetryPublisherDeps {
  write: TrackTelemetryWriter
  intervalMs?: number
  now?: () => number
  onError?: (err: unknown) => void
}

export interface TrackTelemetryPublisher {
  start(): void
  stop(): void
  tickNow(): Promise<void>
}

const DEFAULT_INTERVAL_MS = 1000

export const createTrackTelemetryPublisher = (
  deps: TrackTelemetryPublisherDeps
): TrackTelemetryPublisher => {
  const intervalMs = deps.intervalMs ?? DEFAULT_INTERVAL_MS
  const now = deps.now ?? Date.now
  const onError =
    deps.onError ??
    ((err) => {
      const detail = err instanceof Error ? err.message : String(err)
      log('warn', `TrackTelemetry publish failed: ${detail}`)
    })

  let handle: ReturnType<typeof setInterval> | null = null
  let prevBestLapMs = 0
  let pendingPulse = false

  const tick = async (): Promise<void> => {
    const state = useTrackSessionStore.getState()

    if (
      state.bestLapMs > 0 &&
      state.bestLapMs !== prevBestLapMs &&
      (prevBestLapMs === 0 || state.bestLapMs < prevBestLapMs)
    ) {
      pendingPulse = true
    }
    prevBestLapMs = state.bestLapMs

    const payload = buildTrackTelemetry({
      recording: state.recording,
      sessionStartMs: state.sessionStartMs,
      laps: state.laps,
      bestLapMs: state.bestLapMs,
      nowMs: now(),
      bestLapPulse: pendingPulse,
    })
    pendingPulse = false

    const parsed = TrackTelemetrySchema.safeParse(payload)
    if (!parsed.success) {
      onError(
        new Error(
          `TrackTelemetry payload failed schema validation: ${parsed.error.issues
            .map((i) => `${i.path.join('.')}: ${i.message}`)
            .join('; ')}`
        )
      )
      return
    }

    try {
      await deps.write(parsed.data)
    } catch (err) {
      onError(err)
    }
  }

  return {
    start() {
      if (handle !== null) return
      void tick()
      handle = setInterval(() => {
        void tick()
      }, intervalMs)
    },
    stop() {
      if (handle !== null) {
        clearInterval(handle)
        handle = null
      }
      prevBestLapMs = 0
      pendingPulse = false
    },
    tickNow: tick,
  }
}
