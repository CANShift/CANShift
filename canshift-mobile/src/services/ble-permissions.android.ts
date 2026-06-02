// ble-permissions.android.ts — Android 12+ runtime permission flow.
//
// Picked by Metro on Android builds. See ble-permissions.ts for the
// declared public surface and ble-permissions.ios.ts for the iOS no-op.

import { PermissionsAndroid, Platform, type Permission } from 'react-native'

import type { AndroidBlePermissionResult } from './ble-permissions'

/** Android API level at which BLUETOOTH_SCAN / BLUETOOTH_CONNECT became
 *  runtime permissions. Below this, the legacy install-time permissions
 *  declared in app.json are sufficient. */
const ANDROID_API_LEVEL_S = 31

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

export async function requestAndroidBlePermissions(): Promise<AndroidBlePermissionResult> {
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
