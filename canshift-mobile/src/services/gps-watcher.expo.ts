// gps-watcher.expo.ts — `expo-location` adapter for the `GpsWatcher`
// interface from #845 layer 2. This is the only file in the mobile app
// that imports `expo-location`; everything downstream goes through the
// generic `GpsWatcher` so the rest of the code stays hardware-agnostic.
//
// The watcher uses `Location.Accuracy.High` with a 200ms minimum interval
// and a 1m distance threshold — that's the safe sweet spot for circuit
// lap-timing (high enough rate to catch start/finish crossings, low
// enough drain to last a full track day).

import * as Location from 'expo-location'
import type { GpsWatcher, GpsWatcherUpdate } from './gps-subscription'

/** Per-update sample rate cap (ms). 200ms ≈ 5 Hz at the firmware-side cap. */
const TIME_INTERVAL_MS = 200

/** Distance gate — drop samples where the device moved < N metres. */
const DISTANCE_INTERVAL_M = 1

/**
 * Outcome of a permission request. The screen / hook narrows on `granted`
 * to decide whether to start the watcher; the `can-ask-again` flag tells
 * the UI whether to show a "Settings" deep-link instead of a re-prompt.
 */
export type ForegroundPermissionResult =
  | { granted: true }
  | { granted: false; canAskAgain: boolean }

/**
 * Request foreground location permission. Returns a narrow result the UI
 * can switch on; the underlying expo-location response is not surfaced
 * because the screens never need any of its other fields.
 */
export async function requestForegroundLocationPermission(): Promise<ForegroundPermissionResult> {
  const response = await Location.requestForegroundPermissionsAsync()
  if (response.granted) return { granted: true }
  return { granted: false, canAskAgain: response.canAskAgain }
}

/**
 * `expo-location`-backed implementation of `GpsWatcher`. Pure adapter:
 * converts `LocationObject` → `GpsWatcherUpdate` and returns a detacher
 * that calls `subscription.remove()`.
 *
 * Caller is responsible for permission gating — calling `start()` before
 * permissions are granted will reject with the platform error verbatim.
 */
export const expoLocationWatcher: GpsWatcher = {
  async start(onUpdate) {
    const subscription = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.High,
        timeInterval: TIME_INTERVAL_MS,
        distanceInterval: DISTANCE_INTERVAL_M,
      },
      (location) => {
        onUpdate(toUpdate(location))
      }
    )
    return () => {
      subscription.remove()
    }
  },
}

/** Pure conversion from expo-location's payload to our domain shape. */
function toUpdate(location: Location.LocationObject): GpsWatcherUpdate {
  return {
    t: location.timestamp,
    lat: location.coords.latitude,
    lng: location.coords.longitude,
    speedMs: location.coords.speed,
    headingDeg: location.coords.heading,
  }
}
