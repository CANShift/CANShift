import * as Location from 'expo-location'
import type { GpsWatcher, GpsWatcherUpdate } from './gps-subscription'

const TIME_INTERVAL_MS = 200

const DISTANCE_INTERVAL_M = 1

export type ForegroundPermissionResult =
  | { granted: true }
  | { granted: false; canAskAgain: boolean }

export const requestForegroundLocationPermission =
  async (): Promise<ForegroundPermissionResult> => {
    const response = await Location.requestForegroundPermissionsAsync()
    if (response.granted) return { granted: true }
    return { granted: false, canAskAgain: response.canAskAgain }
  }

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

const toUpdate = (location: Location.LocationObject): GpsWatcherUpdate => {
  return {
    t: location.timestamp,
    lat: location.coords.latitude,
    lng: location.coords.longitude,
    speedMs: location.coords.speed,
    headingDeg: location.coords.heading,
  }
}
