// ble.errors.ts — Discriminated BLE error union and mapping helper
//
// `react-native-ble-plx` rejects with `BleError` whose `errorCode` is a number
// from the `BleErrorCode` enum. Our service layer surfaces a UI-friendly
// discriminated union instead, so screens can switch exhaustively on the
// failure mode (permission, off, out of range, …) without poking at numbers.
//
// Tests live next to this file; consumers (UI + service) import the union and
// the `mapBleError` helper.

import { BleErrorCode } from 'react-native-ble-plx'
import { Platform } from 'react-native'

// ---------------------------------------------------------------------------
// Discriminated union
// ---------------------------------------------------------------------------

/**
 * UI-facing classification of a BLE failure. The shape is stable across
 * platforms; the `permission-denied` variant carries the platform tag so
 * screens can render iOS-vs-Android copy and CTAs.
 */
export type BleConnectionError =
  | { kind: 'permission-denied'; platform: 'ios' | 'android' }
  | { kind: 'bluetooth-off' }
  | { kind: 'not-paired' }
  | { kind: 'not-in-range' }
  | { kind: 'disconnected' }
  | { kind: 'characteristic-missing'; uuid?: string }
  | { kind: 'write-failed'; reason?: string }
  | { kind: 'unknown'; message: string }

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Type guard — does the unknown error look like a `BleError` with a numeric
 *  `errorCode` we can switch on? The numeric value is treated as a `BleErrorCode`
 *  for switch exhaustiveness; unrecognised numbers fall through to `default`. */
function hasErrorCode(err: unknown): err is { errorCode: BleErrorCode } {
  if (err === null || typeof err !== 'object') return false
  const code = (err as { errorCode?: unknown }).errorCode
  return typeof code === 'number'
}

/** Best-effort string for the `unknown` fallback. Avoids leaking objects. */
function describe(err: unknown): string {
  if (err instanceof Error) return err.message
  if (typeof err === 'string') return err
  return 'Unknown BLE error'
}

/** Best-effort retrieval of a write-failure reason for diagnostics. */
function writeFailureReason(err: unknown): string | undefined {
  if (err instanceof Error && err.message.length > 0) return err.message
  if (
    err !== null &&
    typeof err === 'object' &&
    'reason' in err &&
    typeof (err as { reason?: unknown }).reason === 'string'
  ) {
    return (err as { reason: string }).reason
  }
  return undefined
}

function currentPlatform(): 'ios' | 'android' {
  return Platform.OS === 'android' ? 'android' : 'ios'
}

// ---------------------------------------------------------------------------
// Mapping
// ---------------------------------------------------------------------------

/**
 * Map any thrown value from a BLE call into a `BleConnectionError`.
 * - Recognises our own `android_ble_permission_denied` sentinel (thrown from
 *   `ensureAndroidBlePermissions`) and surfaces it as `permission-denied`.
 * - Recognises `BleError`-shaped objects via `errorCode` and switches over the
 *   `BleErrorCode` enum.
 * - Falls back to `{ kind: 'unknown', message }` for everything else.
 */
export function mapBleError(err: unknown): BleConnectionError {
  // App-level sentinel from ensureAndroidBlePermissions(): treat as permission
  // denied regardless of platform. Android is the only emitter today.
  if (err instanceof Error) {
    const code = (err as Error & { code?: string }).code
    if (
      code === 'android_ble_permission_denied' ||
      err.message === 'android_ble_permission_denied'
    ) {
      return { kind: 'permission-denied', platform: 'android' }
    }
  }

  if (!hasErrorCode(err)) {
    return { kind: 'unknown', message: describe(err) }
  }

  switch (err.errorCode) {
    case BleErrorCode.BluetoothUnauthorized:
      return { kind: 'permission-denied', platform: currentPlatform() }
    case BleErrorCode.BluetoothPoweredOff:
      return { kind: 'bluetooth-off' }
    case BleErrorCode.DeviceNotFound:
      return { kind: 'not-paired' }
    case BleErrorCode.DeviceConnectionFailed:
    case BleErrorCode.OperationTimedOut:
      return { kind: 'not-in-range' }
    case BleErrorCode.DeviceDisconnected:
    case BleErrorCode.DeviceNotConnected:
      return { kind: 'disconnected' }
    case BleErrorCode.CharacteristicNotFound:
    case BleErrorCode.ServiceNotFound:
    case BleErrorCode.CharacteristicsNotDiscovered:
    case BleErrorCode.ServicesNotDiscovered:
      return { kind: 'characteristic-missing' }
    case BleErrorCode.CharacteristicWriteFailed:
    case BleErrorCode.CharacteristicReadFailed: {
      const reason = writeFailureReason(err)
      return reason !== undefined ? { kind: 'write-failed', reason } : { kind: 'write-failed' }
    }
    default:
      return { kind: 'unknown', message: describe(err) }
  }
}

// ---------------------------------------------------------------------------
// Description helper (for logs — never user-facing copy)
// ---------------------------------------------------------------------------

/**
 * Compact, log-friendly description of a `BleConnectionError`. Screens render
 * their own user-facing messages off `error.kind`; this is for `log('error', …)`
 * and similar diagnostics.
 */
export function describeBleError(err: BleConnectionError): string {
  switch (err.kind) {
    case 'permission-denied':
      return `permission denied (${err.platform})`
    case 'bluetooth-off':
      return 'bluetooth off'
    case 'not-paired':
      return 'device not paired or not found'
    case 'not-in-range':
      return 'device not in range'
    case 'disconnected':
      return 'device disconnected'
    case 'characteristic-missing':
      return err.uuid ? `characteristic missing (${err.uuid})` : 'characteristic missing'
    case 'write-failed':
      return err.reason ? `write failed: ${err.reason}` : 'write failed'
    case 'unknown':
      return err.message
    default: {
      const _exhaustive: never = err
      return _exhaustive
    }
  }
}
