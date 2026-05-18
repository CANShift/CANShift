// gps-subscription.ts — Manages an active GPS subscription and pipes
// position updates into the track-session store (#845 layer 2).
//
// Hardware access (`expo-location`) is injected via the `GpsWatcher`
// interface so the service is fully unit-testable without a device. A
// layer 3 PR will provide the real expo-location adapter.

import { pushSample } from '../stores/track-session.store'

/** Single GPS reading delivered by the watcher to its callback. */
export interface GpsWatcherUpdate {
  /** Wall-clock ms — usually `Date.now()` at the time of the sample. */
  t: number
  lat: number
  lng: number
  /** Ground speed in m/s, or `null` when the OS didn't report a speed. */
  speedMs: number | null
  /** Heading in degrees [0, 360); `null` when stationary or unavailable. */
  headingDeg: number | null
}

/**
 * Minimal watcher interface — `start` registers a callback that fires on
 * every GPS fix; the returned function stops the watcher. Mirrors the
 * shape of `Location.watchPositionAsync` so the future expo-location
 * adapter is a thin wrapper.
 */
export interface GpsWatcher {
  start(onUpdate: (update: GpsWatcherUpdate) => void): Promise<() => void>
}

/** Handle returned by `startGpsSubscription` — call `stop` to detach. */
export interface GpsSubscription {
  stop(): void
}

/**
 * Start streaming GPS samples into the track-session store. Returns once
 * the watcher has been registered (or rejects when the watcher itself
 * rejects, e.g. on permission denial). The returned handle's `stop()`
 * detaches the watcher; calling it more than once is a no-op.
 *
 * Heading and speed are optional on the wire — null is mapped to 0 so the
 * store's `GpsSample` shape (no nullables) stays simple. Consumers that
 * care about "was a speed reported?" should look at the source (the
 * watcher's `speedMs` field) rather than the stored value.
 */
export async function startGpsSubscription(watcher: GpsWatcher): Promise<GpsSubscription> {
  const detach = await watcher.start((update) => {
    pushSample({
      t: update.t,
      lat: update.lat,
      lng: update.lng,
      speedMs: update.speedMs ?? 0,
      headingDeg: update.headingDeg ?? 0,
    })
  })
  let stopped = false
  return {
    stop() {
      if (stopped) return
      stopped = true
      detach()
    },
  }
}
