// ble-permissions.ts — Public surface for the BLE permission flow.
//
// Platform-specific implementations live in `.android.ts` / `.ios.ts`
// siblings — Metro picks the right one at bundle time per the file
// extension. iOS doesn't need runtime permissions for BLE, so its
// implementation always returns `not_applicable`. Android 12+ runs the
// real `PermissionsAndroid.requestMultiple` flow.
//
// The `declare function` below keeps TypeScript happy without forcing a
// JS body in this file (Metro never resolves `ble-permissions.ts` itself
// at runtime — only `ble-permissions.ios.ts` / `.android.ts`). Closes
// #1017 M-HI-4 for this module.

/** Result of a runtime permission request on Android. */
export type AndroidBlePermissionResult =
  | { kind: 'granted' }
  | { kind: 'denied' }
  | { kind: 'never_ask_again' }
  | { kind: 'not_applicable' }

/**
 * Request the Android 12+ runtime BLE permissions if needed.
 *
 * - On non-Android platforms, returns `not_applicable` immediately.
 * - On Android < 12 (API < 31), returns `not_applicable` — the install-time
 *   `BLUETOOTH` / `BLUETOOTH_ADMIN` permissions cover BLE there.
 * - On Android 12+, requests `BLUETOOTH_SCAN` + `BLUETOOTH_CONNECT` and maps
 *   the result to a discriminated union the caller can switch on exhaustively.
 */
export declare function requestAndroidBlePermissions(): Promise<AndroidBlePermissionResult>
