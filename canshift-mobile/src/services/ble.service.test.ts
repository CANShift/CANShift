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

jest.mock('./last-device', () => ({
  rememberDevice: jest.fn(() => Promise.resolve()),
  forgetDevice: jest.fn(() => Promise.resolve()),
  getLastDevice: jest.fn(() => Promise.resolve(null)),
}))

import { BleErrorCode, BleManager as MockBleManager } from 'react-native-ble-plx'
import type { BleManager, Device } from 'react-native-ble-plx'
import { BleService, isBleAvailable } from './ble.service'
import { mapBleError } from './ble.errors'
import { forgetDevice } from './last-device'
import { useDeviceStore } from '../stores/device.store'

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

describe('BleService disconnect', () => {
  it('still clears state and forgets the device when cancelConnection rejects', async () => {
    const service = makeService()
    const device = {
      id: 'test-device',
      cancelConnection: jest.fn(() => Promise.reject(new Error('gatt busy'))),
    } as unknown as Device
    service._test_setConnectedDevice(device)

    await expect(service.disconnect()).resolves.toBeUndefined()

    expect(jest.mocked(forgetDevice)).toHaveBeenCalled()
    expect(useDeviceStore.getState().connectionState).toBe('idle')
  })
})

describe('BleService scan cancellation', () => {
  type ScanListener = (
    error: { message: string } | null,
    device: { id: string; name: string } | null
  ) => void

  const makeScanService = () => {
    const startDeviceScan = jest.fn<undefined, [string[], Record<string, unknown>, ScanListener]>()
    const stopDeviceScan = jest.fn()
    const managerStub = {
      destroy: jest.fn(),
      startDeviceScan,
      stopDeviceScan,
    } as unknown as BleManager
    const service = new BleService({
      managerFactory: () => managerStub,
      requestAndroidPermissions: () => Promise.resolve({ kind: 'not_applicable' }),
    })
    return { service, startDeviceScan, stopDeviceScan }
  }

  it('stopScan settles an in-flight scan before the timeout', async () => {
    const { service, stopDeviceScan } = makeScanService()
    const scanPromise = service.scan(jest.fn(), 60_000)
    await flush()

    service.stopScan()

    await expect(scanPromise).resolves.toBeUndefined()
    expect(stopDeviceScan).toHaveBeenCalled()
  })

  it('ignores scan results delivered after stopScan settled the scan', async () => {
    const { service, startDeviceScan } = makeScanService()
    const onFound = jest.fn()
    const scanPromise = service.scan(onFound, 60_000)
    await flush()

    const listener = startDeviceScan.mock.calls[0]?.[2]
    expect(listener).toBeDefined()

    service.stopScan()
    await scanPromise

    listener?.(null, { id: 'dev-1', name: 'CANShift-test' })
    expect(onFound).not.toHaveBeenCalled()
  })

  it('stopScan without an active scan still stops native scanning', () => {
    const { service, stopDeviceScan } = makeScanService()
    service.stopScan()
    expect(stopDeviceScan).toHaveBeenCalledTimes(1)
  })
})

describe('BleService connect', () => {
  it('aborts any in-flight reconnect loop before connecting', async () => {
    const managerStub = {
      destroy: jest.fn(),
      stopDeviceScan: jest.fn(),
      connectToDevice: jest.fn(() => Promise.reject(new Error('unreachable'))),
    } as unknown as BleManager
    const service = new BleService({
      managerFactory: () => managerStub,
      requestAndroidPermissions: () => Promise.resolve({ kind: 'not_applicable' }),
    })
    const cancelSpy = jest.spyOn(service, 'cancelReconnect')

    await expect(service.connect('dev-1')).rejects.toThrow('unreachable')

    expect(cancelSpy).toHaveBeenCalled()
  })
})

describe('EXPO_PUBLIC_DISABLE_BLE', () => {
  const original = process.env.EXPO_PUBLIC_DISABLE_BLE as string | undefined

  beforeEach(() => {
    ;(MockBleManager as jest.Mock).mockClear()
  })

  afterEach(() => {
    if (original === undefined) delete process.env.EXPO_PUBLIC_DISABLE_BLE
    else process.env.EXPO_PUBLIC_DISABLE_BLE = original
  })

  it('skips CoreBluetooth activation and reports BLE unavailable when set to "1"', () => {
    process.env.EXPO_PUBLIC_DISABLE_BLE = '1'
    new BleService()
    expect(MockBleManager).not.toHaveBeenCalled()
    expect(isBleAvailable()).toBe(false)
  })

  it('constructs the native manager when unset', () => {
    delete process.env.EXPO_PUBLIC_DISABLE_BLE
    new BleService()
    expect(MockBleManager).toHaveBeenCalled()
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
