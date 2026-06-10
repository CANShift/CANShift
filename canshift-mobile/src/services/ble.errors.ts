import { BleErrorCode } from 'react-native-ble-plx'

import { currentPlatform } from '../lib/platform'

export type BleConnectionError =
  | { kind: 'permission-denied'; platform: 'ios' | 'android' }
  | { kind: 'bluetooth-off' }
  | { kind: 'not-paired' }
  | { kind: 'not-in-range' }
  | { kind: 'disconnected' }
  | { kind: 'characteristic-missing'; uuid?: string }
  | { kind: 'write-failed'; reason?: string }
  | { kind: 'unknown'; message: string }

const hasErrorCode = (err: unknown): err is { errorCode: BleErrorCode } => {
  if (err === null || typeof err !== 'object') return false
  const code = (err as { errorCode?: unknown }).errorCode
  return typeof code === 'number'
}

const describe = (err: unknown): string => {
  if (err instanceof Error) return err.message
  if (typeof err === 'string') return err
  return 'Unknown BLE error'
}

const writeFailureReason = (err: unknown): string | undefined => {
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

export const mapBleError = (err: unknown): BleConnectionError => {
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

export const describeBleError = (err: BleConnectionError): string => {
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
