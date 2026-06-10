jest.mock('react-native-ble-plx', () => ({
  BleManager: jest.fn().mockImplementation(() => ({
    state: jest.fn(),
    destroy: jest.fn(),
    startDeviceScan: jest.fn(),
    stopDeviceScan: jest.fn(),
  })),
  State: {
    PoweredOn: 'PoweredOn',
    PoweredOff: 'PoweredOff',
    Unauthorized: 'Unauthorized',
    Unsupported: 'Unsupported',
    Resetting: 'Resetting',
    Unknown: 'Unknown',
  },
  BleErrorCode: {
    BluetoothUnauthorized: 101,
    BluetoothPoweredOff: 102,
    DeviceConnectionFailed: 200,
    DeviceDisconnected: 201,
    DeviceNotFound: 204,
    DeviceNotConnected: 205,
    OperationTimedOut: 3,
    ServiceNotFound: 302,
    ServicesNotDiscovered: 303,
    CharacteristicWriteFailed: 401,
    CharacteristicReadFailed: 402,
    CharacteristicNotFound: 404,
    CharacteristicsNotDiscovered: 405,
  },
}))

import { BleErrorCode } from 'react-native-ble-plx'
import type { BleManager, Device } from 'react-native-ble-plx'
import { BleService } from './ble.service'
import { mapBleError } from './ble.errors'

interface PendingOp {
  resolve: (value: unknown) => void
  reject: (reason: unknown) => void
}

interface DeferredFactory {
  pending: PendingOp[]
  next: () => Promise<unknown>
}

const makeDeferredFactory = (): DeferredFactory => {
  const pending: PendingOp[] = []
  const next = () =>
    new Promise<unknown>((resolve, reject) => {
      pending.push({ resolve, reject })
    })
  return { pending, next }
}

const makeStubDevice = (factory: DeferredFactory): Device => {
  const stub = {
    id: 'test-device',
    name: 'CANShift-test',
    writeCharacteristicWithResponseForService: jest.fn(() => factory.next()),
    writeCharacteristicWithoutResponseForService: jest.fn(() => factory.next()),
    readCharacteristicForService: jest.fn(() => factory.next()),
  }
  return stub as unknown as Device
}

const makeService = (): BleService => {
  const managerStub = {
    destroy: jest.fn(),
    stopDeviceScan: jest.fn(),
  } as unknown as BleManager
  return new BleService({
    managerFactory: () => managerStub,
    requestAndroidPermissions: () => Promise.resolve({ kind: 'not_applicable' }),
  })
}

const flush = (): Promise<void> => {
  return new Promise((resolve) => {
    setImmediate(resolve)
  })
}

describe('BleService GATT serializer', () => {
  it('serializes concurrent writes — second op does not start until first settles', async () => {
    const factory = makeDeferredFactory()
    const service = makeService()
    service._test_setConnectedDevice(makeStubDevice(factory))

    const first = service.pushSettings({ brightness: 50, sleep: 0 })
    const second = service.sendCmd('ping')

    await flush()

    expect(factory.pending).toHaveLength(1)

    factory.pending[0]?.resolve(undefined)
    await first
    await flush()

    expect(factory.pending).toHaveLength(2)
    factory.pending[1]?.resolve(undefined)
    await second
  })

  it('isolates failures — a rejected op does not prevent subsequent ops from running', async () => {
    const factory = makeDeferredFactory()
    const service = makeService()
    service._test_setConnectedDevice(makeStubDevice(factory))

    const first = service.sendCmd('boom')
    const second = service.sendCmd('next')

    await flush()
    expect(factory.pending).toHaveLength(1)

    const failure = new Error('write failed')
    factory.pending[0]?.reject(failure)
    await expect(first).rejects.toBe(failure)
    await flush()

    expect(factory.pending).toHaveLength(2)
    factory.pending[1]?.resolve(undefined)
    await expect(second).resolves.toBeUndefined()
  })
})

describe('mapBleError', () => {
  it('maps the android permission-denied sentinel (Error with .code) to permission-denied/android', () => {
    const err = new Error('android_ble_permission_denied') as Error & { code?: string }
    err.code = 'android_ble_permission_denied'
    expect(mapBleError(err)).toEqual({ kind: 'permission-denied', platform: 'android' })
  })

  it('maps BleErrorCode.BluetoothUnauthorized to permission-denied with current platform', () => {
    const result = mapBleError({ errorCode: BleErrorCode.BluetoothUnauthorized })
    expect(result.kind).toBe('permission-denied')
    if (result.kind === 'permission-denied') {
      expect(['ios', 'android']).toContain(result.platform)
    }
  })

  it('maps BleErrorCode.BluetoothPoweredOff to bluetooth-off', () => {
    expect(mapBleError({ errorCode: BleErrorCode.BluetoothPoweredOff })).toEqual({
      kind: 'bluetooth-off',
    })
  })

  it('maps BleErrorCode.DeviceNotFound to not-paired', () => {
    expect(mapBleError({ errorCode: BleErrorCode.DeviceNotFound })).toEqual({
      kind: 'not-paired',
    })
  })

  it('maps BleErrorCode.DeviceConnectionFailed and OperationTimedOut to not-in-range', () => {
    expect(mapBleError({ errorCode: BleErrorCode.DeviceConnectionFailed })).toEqual({
      kind: 'not-in-range',
    })
    expect(mapBleError({ errorCode: BleErrorCode.OperationTimedOut })).toEqual({
      kind: 'not-in-range',
    })
  })

  it('maps disconnect-related error codes to disconnected', () => {
    expect(mapBleError({ errorCode: BleErrorCode.DeviceDisconnected })).toEqual({
      kind: 'disconnected',
    })
    expect(mapBleError({ errorCode: BleErrorCode.DeviceNotConnected })).toEqual({
      kind: 'disconnected',
    })
  })

  it('maps missing-characteristic / service codes to characteristic-missing', () => {
    expect(mapBleError({ errorCode: BleErrorCode.CharacteristicNotFound })).toEqual({
      kind: 'characteristic-missing',
    })
    expect(mapBleError({ errorCode: BleErrorCode.ServiceNotFound })).toEqual({
      kind: 'characteristic-missing',
    })
  })

  it('maps write/read failure codes to write-failed', () => {
    const result = mapBleError({
      errorCode: BleErrorCode.CharacteristicWriteFailed,
      reason: 'gatt 133',
    })
    expect(result.kind).toBe('write-failed')
    if (result.kind === 'write-failed') {
      expect(result.reason).toBe('gatt 133')
    }
  })

  it('falls back to unknown for arbitrary thrown values', () => {
    expect(mapBleError(undefined)).toEqual({ kind: 'unknown', message: 'Unknown BLE error' })
    expect(mapBleError('string error')).toEqual({ kind: 'unknown', message: 'string error' })
    expect(mapBleError({ errorCode: 99999 })).toMatchObject({ kind: 'unknown' })
  })
})
