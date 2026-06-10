import { PermissionsAndroid, Platform, type Permission } from 'react-native'

import type { AndroidBlePermissionResult } from './ble-permissions'

const ANDROID_API_LEVEL_S = 31

const bleRuntimePermissions = (): Permission[] => {
  return [
    PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
    PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
  ].filter((p): p is Permission => typeof p === 'string')
}

export const requestAndroidBlePermissions = async (): Promise<AndroidBlePermissionResult> => {
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
