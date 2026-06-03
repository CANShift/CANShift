// ble-permissions.ios.ts — iOS BLE permission stub.
//
// Picked by Metro on iOS builds. CoreBluetooth doesn't expose
// runtime-grantable permissions through the JS layer — the user-facing
// prompt is triggered by the first `CBCentralManager` operation and
// surfaces via state changes on the BleManager instance, not through a
// promise we can await here. So this stub always reports
// `not_applicable` and the caller continues straight to the connect path.

import type { AndroidBlePermissionResult } from './ble-permissions'

export function requestAndroidBlePermissions(): Promise<AndroidBlePermissionResult> {
  return Promise.resolve({ kind: 'not_applicable' })
}
