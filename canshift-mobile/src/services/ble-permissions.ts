// ble-permissions.ts — Android 12+ runtime permission flow for BLE scan/connect

import { PermissionsAndroid, Platform, type Permission } from 'react-native'

/** Android API level at which BLUETOOTH_SCAN / BLUETOOTH_CONNECT became
 *  runtime permissions. Below this, the legacy install-time permissions
 *  declared in app.json are sufficient. */
const ANDROID_API_LEVEL_S = 31

/** Result of a runtime permission request on Android. */
export type AndroidBlePermissionResult =
  | { kind: 'granted' }
  | { kind: 'denied' }
  | { kind: 'never_ask_again' }
  | { kind: 'not_applicable' }

/** `PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN` and friends are typed as
 *  `Permission | undefined` because the constants only exist on Android 12+.
 *  We've already gated by `Platform.Version >= 31`, so non-null assertion is
 *  sound here, but we expose a small helper to keep that local. */
function bleRuntimePermissions(): Permission[] {
  return [
    PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
    PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
  ].filter((p): p is Permission => typeof p === 'string')
}

/**
 * Request the Android 12+ runtime BLE permissions if needed.
 *
 * - On non-Android platforms, returns `not_applicable` immediately.
 * - On Android < 12 (API < 31), returns `not_applicable` — the install-time
 *   `BLUETOOTH` / `BLUETOOTH_ADMIN` permissions cover BLE there.
 * - On Android 12+, requests `BLUETOOTH_SCAN` + `BLUETOOTH_CONNECT` and maps
 *   the result to a discriminated union the caller can switch on exhaustively.
 */
export async function requestAndroidBlePermissions(): Promise<AndroidBlePermissionResult> {
  if (Platform.OS !== 'android') return { kind: 'not_applicable' }
  if (typeof Platform.Version !== 'number' || Platform.Version < ANDROID_API_LEVEL_S) {
    return { kind: 'not_applicable' }
  }

  const permissions = bleRuntimePermissions()
  if (permissions.length === 0) return { kind: 'not_applicable' }

  const results = await PermissionsAndroid.requestMultiple(permissions)
  const values = permissions.map((p) => results[p])

  if (values.every((v) => v === PermissionsAndroid.RESULTS.GRANTED)) {
    return { kind: 'granted' }
  }
  if (values.some((v) => v === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN)) {
    return { kind: 'never_ask_again' }
  }
  return { kind: 'denied' }
}
