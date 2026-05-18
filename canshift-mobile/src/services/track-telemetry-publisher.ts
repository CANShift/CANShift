// track-telemetry-publisher.ts — 1 Hz publisher loop that snapshots the
// track-session store, builds a `TrackTelemetry` payload via the pure
// builder, and writes it to the firmware (#845 layer 4 / #887 part 3).
//
// The actual BLE write is injected — keeps this module hardware-agnostic
// and fully unit-testable. The real BLE adapter lives in `ble.service`
// (a layer 4 follow-up) and just hands its `sendTrackTelemetry` here.
//
// State the publisher itself tracks:
//   - the previous `bestLapMs` it saw, so it can fire the one-shot
//     `bestLapPulse` flag exactly once per new personal-best,
//   - the active interval handle, so it can be cleanly stopped.

import type { TrackTelemetry } from '@tmbk/canshift-core'
import { useTrackSessionStore } from '../stores/track-session.store'
import { buildTrackTelemetry } from './track-telemetry'

/** Function the publisher calls each tick to push the payload over the wire. */
export type TrackTelemetryWriter = (payload: TrackTelemetry) => Promise<void>

export interface TrackTelemetryPublisherDeps {
  /** BLE write — typically `BleService.sendTrackTelemetry`. */
  write: TrackTelemetryWriter
  /** Tick interval in ms. Default 1000 (1 Hz). */
  intervalMs?: number
  /** Wall clock — overridable for deterministic tests. Default Date.now. */
  now?: () => number
  /** Best-effort failure sink. Default: console.warn. */
  onError?: (err: unknown) => void
}

export interface TrackTelemetryPublisher {
  /** Start the periodic write loop. Idempotent. */
  start(): void
  /** Stop the loop and clear pulse state. Idempotent. */
  stop(): void
  /** Emit a single payload immediately, without scheduling. Used in tests. */
  tickNow(): Promise<void>
}

const DEFAULT_INTERVAL_MS = 1000

/**
 * Build a publisher with the given write function. Construction is cheap;
 * no work happens until `start()` is called.
 */
export function createTrackTelemetryPublisher(
  deps: TrackTelemetryPublisherDeps
): TrackTelemetryPublisher {
  const intervalMs = deps.intervalMs ?? DEFAULT_INTERVAL_MS
  const now = deps.now ?? Date.now
  const onError =
    deps.onError ??
    ((err) => {
      console.warn('TrackTelemetry publish failed', err)
    })

  let handle: ReturnType<typeof setInterval> | null = null
  // Last bestLapMs we observed. Used to detect a fresh personal-best so
  // we fire `isBestLap=true` for exactly one tick.
  let prevBestLapMs = 0
  // True when the NEXT tick should set `bestLapPulse=true`. Cleared after.
  let pendingPulse = false

  async function tick(): Promise<void> {
    const state = useTrackSessionStore.getState()

    // Detect a new best lap by comparing the store's bestLapMs against
    // what we observed last tick. Two conditions to fire the pulse:
    //   1) the value changed (i.e. a lap finished this interval), and
    //   2) the new value is strictly less than the prior (faster) OR the
    //      prior was 0 (very first lap of the session).
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
    // Consume the pulse — even if the write fails, we don't want to
    // re-fire it on the next tick (the firmware already missed it).
    pendingPulse = false

    try {
      await deps.write(payload)
    } catch (err) {
      onError(err)
    }
  }

  return {
    start() {
      if (handle !== null) return
      // Emit an initial payload immediately so the firmware doesn't have
      // to wait a full interval before learning the session state.
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
