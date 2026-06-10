import type { AndroidBlePermissionResult } from './ble-permissions'

export const requestAndroidBlePermissions = (): Promise<AndroidBlePermissionResult> => {
  return Promise.resolve({ kind: 'not_applicable' })
}
