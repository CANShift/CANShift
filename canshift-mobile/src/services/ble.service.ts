import {
  BleManager,
  Device,
  State,
  Characteristic,
  Subscription,
  type BleRestoredState,
} from 'react-native-ble-plx'
import { currentPlatform } from '../lib/platform'
import {
  BLE_SERVICE_UUID,
  BLE_CHAR_TELE,
  BLE_CHAR_STATUS,
  BLE_CHAR_SETTINGS,
  BLE_CHAR_CMD,
  BLE_DEVICE_NAME,
} from '../constants/ble'
import { useDeviceStore } from '../stores/device.store'
import { useSignalsStore } from '../stores/signals.store'
import { clearBuffer } from '../stores/telemetry.store'
import { log } from '../stores/log.store'
import { useReconnectStore } from '../stores/reconnect.store'
import { parseTelemetry } from './ble.validators'
import { parseBleStatus } from '@tmbk/canshift-core'
import { decodeBase64, encodeBase64 } from './base64'
import { rememberDevice, forgetDevice, getLastDevice } from './last-device'
import { requestAndroidBlePermissions, type AndroidBlePermissionResult } from './ble-permissions'
import { mapBleError, describeBleError } from './ble.errors'
import { withGattRetry } from './ble.retry'

export interface ScanResult {
  id: string
  name: string
}

export type CmdPayload = Record<string, boolean | number | string>

export type BlePermissionState =
  | { kind: 'ok' }
  | { kind: 'powered_off' }
  | { kind: 'unauthorized'; platform: 'ios' | 'android' }
  | { kind: 'unsupported' }
  | { kind: 'resetting' }
  | { kind: 'unknown' }

const BLE_RESTORE_STATE_IDENTIFIER = 'canshift.ble.central'

const RECONNECT_INITIAL_DELAY_MS = 1_000
const RECONNECT_MAX_DELAY_MS = 30_000
const RECONNECT_BACKOFF_FACTOR = 2
const RECONNECT_JITTER_RATIO = 0.2
const RECONNECT_MAX_ATTEMPTS = 6
const RECONNECT_SCAN_TIMEOUT_MS = 5_000
const STALENESS_CHECK_INTERVAL_MS = 500
const STALENESS_THRESHOLD_MS = 2_000

const isAborted = (signal: AbortSignal): boolean => {
  return signal.aborted
}

const computeBackoffDelay = (attempt: number): number => {
  const exponential = RECONNECT_INITIAL_DELAY_MS * Math.pow(RECONNECT_BACKOFF_FACTOR, attempt)
  const capped = Math.min(exponential, RECONNECT_MAX_DELAY_MS)
  const jitter = capped * RECONNECT_JITTER_RATIO * (Math.random() * 2 - 1)
  return Math.max(0, Math.round(capped + jitter))
}

const sleepWithAbort = (ms: number, signal: AbortSignal): Promise<void> => {
  return new Promise((resolve) => {
    if (signal.aborted) {
      resolve()
      return
    }
    const handle = setTimeout(() => {
      signal.removeEventListener('abort', onAbort)
      resolve()
    }, ms)
    const onAbort = () => {
      clearTimeout(handle)
      signal.removeEventListener('abort', onAbort)
      resolve()
    }
    signal.addEventListener('abort', onAbort)
  })
}

export interface BleServiceDeps {
  managerFactory?: () => BleManager
  requestAndroidPermissions?: () => Promise<AndroidBlePermissionResult>
}

export class BleService {
  private readonly manager: BleManager
  private readonly requestAndroidPermissions: () => Promise<AndroidBlePermissionResult>

  private connectedDevice: Device | null = null
  private stalenessTimer: ReturnType<typeof setInterval> | null = null
  private teleSub: Subscription | null = null
  private statusSub: Subscription | null = null
  private disconnectSub: Subscription | null = null
  private reconnectController: AbortController | null = null

  private userInitiatedDisconnect = false

  private gattQueue: Promise<unknown> = Promise.resolve()

  private runGatt<T>(op: () => Promise<T>): Promise<T> {
    const next = this.gattQueue.then(op, op)
    this.gattQueue = next.catch(() => undefined)
    return next
  }

  constructor(deps: BleServiceDeps = {}) {
    const factory =
      deps.managerFactory ??
      (() =>
        new BleManager({
          restoreStateIdentifier: BLE_RESTORE_STATE_IDENTIFIER,
          restoreStateFunction: (restoredState) => {
            this.handleRestoredState(restoredState)
          },
        }))
    this.manager = factory()
    this.requestAndroidPermissions = deps.requestAndroidPermissions ?? requestAndroidBlePermissions
  }

  async dispose(): Promise<void> {
    this.cancelReconnect()
    this.stopStalenessTimer()
    this.removeSubscriptions()
    if (this.connectedDevice) {
      try {
        await this.connectedDevice.cancelConnection()
      } catch {
        void 0
      }
      this.connectedDevice = null
    }
    await this.manager.destroy()
  }

  async scan(onFound: (device: ScanResult) => void, timeoutMs = 10000): Promise<void> {
    await this.ensureAndroidBlePermissions()
    this.cancelReconnect()
    return new Promise((resolve, reject) => {
      const found = new Set<string>()
      let settled = false
      let timer: ReturnType<typeof setTimeout> | null = null

      void this.manager.startDeviceScan(
        [BLE_SERVICE_UUID],
        { allowDuplicates: false },
        (error, device) => {
          if (settled) return
          if (error) {
            settled = true
            if (timer !== null) clearTimeout(timer)
            void this.manager.stopDeviceScan()
            reject(new Error(error.message))
            return
          }
          if (device?.name?.includes(BLE_DEVICE_NAME) && !found.has(device.id)) {
            found.add(device.id)
            onFound({ id: device.id, name: device.name })
          }
        }
      )

      timer = setTimeout(() => {
        if (settled) return
        settled = true
        void this.manager.stopDeviceScan()
        resolve()
      }, timeoutMs)
    })
  }

  stopScan(): void {
    void this.manager.stopDeviceScan()
  }

  async connect(deviceId: string): Promise<void> {
    const { setConnectionState, setDevice, setFirmwareStatus, setError } = useDeviceStore.getState()

    await this.ensureAndroidBlePermissions()

    setConnectionState('connecting')
    log('info', `Connecting to device ${deviceId}`)

    this.userInitiatedDisconnect = false

    this.removeSubscriptions()

    try {
      const device = await this.manager.connectToDevice(deviceId, { autoConnect: false })
      await device.discoverAllServicesAndCharacteristics()
      this.connectedDevice = device

      await this.seedStatusFromDevice(device, setFirmwareStatus)

      setDevice(deviceId, device.name ?? BLE_DEVICE_NAME)
      useDeviceStore.getState().setMode('ble')
      log('info', `Connected to ${device.name ?? BLE_DEVICE_NAME} (${deviceId})`)

      void rememberDevice(deviceId)
      useReconnectStore.getState().stop()

      this.bindDeviceSubscriptions(device)
      this.startStalenessTimer()
    } catch (err) {
      this.removeSubscriptions()
      this.connectedDevice = null
      const mapped = mapBleError(err)
      setError(mapped)
      log('error', `Connection failed: ${describeBleError(mapped)}`)
      throw err
    }
  }

  async disconnect(): Promise<void> {
    this.userInitiatedDisconnect = true
    this.cancelReconnect()
    this.stopStalenessTimer()
    this.removeSubscriptions()
    if (this.connectedDevice) {
      const id = this.connectedDevice.id
      await this.connectedDevice.cancelConnection()
      this.connectedDevice = null
      log('info', `Disconnected from ${id}`)
    }
    clearBuffer()
    useDeviceStore.getState().disconnect()
    await forgetDevice()
  }

  async pushSettings(settings: { brightness: number; sleep: number }): Promise<void> {
    const device = this.connectedDevice
    if (!device) throw new Error('Not connected')
    const json = JSON.stringify(settings)
    await withGattRetry(() =>
      this.runGatt(() =>
        device.writeCharacteristicWithResponseForService(
          BLE_SERVICE_UUID,
          BLE_CHAR_SETTINGS,
          encodeBase64(json)
        )
      )
    )
  }

  async readSettings(): Promise<{ brightness: number; sleep: number } | null> {
    const device = this.connectedDevice
    if (!device) throw new Error('Not connected')
    const char = await withGattRetry(() =>
      this.runGatt(() => device.readCharacteristicForService(BLE_SERVICE_UUID, BLE_CHAR_SETTINGS))
    )
    if (!char.value) return null
    try {
      const parsed = JSON.parse(decodeBase64(char.value)) as {
        brightness?: number
        sleep?: number
      }
      if (typeof parsed.brightness !== 'number' || typeof parsed.sleep !== 'number') return null
      return { brightness: parsed.brightness, sleep: parsed.sleep }
    } catch {
      return null
    }
  }

  async sendCmd(cmd: string, payload?: CmdPayload): Promise<void> {
    const device = this.connectedDevice
    if (!device) throw new Error('Not connected')
    const body: Record<string, boolean | number | string> = { cmd, ...(payload ?? {}) }
    const json = JSON.stringify(body)
    await withGattRetry(() =>
      this.runGatt(() =>
        device.writeCharacteristicWithoutResponseForService(
          BLE_SERVICE_UUID,
          BLE_CHAR_CMD,
          encodeBase64(json)
        )
      )
    )
  }

  _test_setConnectedDevice(device: Device | null): void {
    this.connectedDevice = device
  }

  async getBlePermissionState(): Promise<BlePermissionState> {
    const state = await this.manager.state()
    switch (state) {
      case State.PoweredOn:
        return { kind: 'ok' }
      case State.PoweredOff:
        return { kind: 'powered_off' }
      case State.Unauthorized:
        return { kind: 'unauthorized', platform: currentPlatform() }
      case State.Unsupported:
        return { kind: 'unsupported' }
      case State.Resetting:
        return { kind: 'resetting' }
      case State.Unknown:
        return { kind: 'unknown' }
      default: {
        const _exhaustive: never = state
        return _exhaustive
      }
    }
  }

  async isBlePowered(): Promise<boolean> {
    const state = await this.manager.state()
    return state === State.PoweredOn
  }

  cancelReconnect(): void {
    if (this.reconnectController) {
      this.reconnectController.abort()
      this.reconnectController = null
    }
    void this.manager.stopDeviceScan()
    useReconnectStore.getState().stop()
  }

  async tryReconnectLastDevice(): Promise<boolean> {
    if (!(await this.isBlePowered())) return false
    const lastId = await getLastDevice()
    if (!lastId) return false
    void this.runReconnectLoop(lastId)
    return true
  }

  private async tryConnectAttempt(
    deviceId: string,
    attempt: number,
    signal: AbortSignal
  ): Promise<'aborted' | 'connected' | 'failed'> {
    try {
      await this.connect(deviceId)
      if (isAborted(signal)) return 'aborted'
      log('info', `Auto-reconnect: succeeded on attempt ${String(attempt)}`)
      return 'connected'
    } catch (err) {
      if (isAborted(signal)) return 'aborted'
      const msg = err instanceof Error ? err.message : 'unknown error'
      log('warn', `Auto-reconnect: connect failed on attempt ${String(attempt)}: ${msg}`)
      return 'failed'
    }
  }

  private async runReconnectLoop(deviceId: string): Promise<void> {
    if (this.reconnectController) {
      log('warn', 'Reconnect loop already running — ignoring duplicate trigger')
      return
    }

    const controller = new AbortController()
    this.reconnectController = controller
    const { signal } = controller
    const reconnectStore = useReconnectStore.getState()
    reconnectStore.start(deviceId, RECONNECT_MAX_ATTEMPTS)

    log('info', `Auto-reconnect: starting for ${deviceId}`)

    try {
      for (let attempt = 1; attempt <= RECONNECT_MAX_ATTEMPTS; attempt++) {
        if (isAborted(signal)) return

        const delay = computeBackoffDelay(attempt - 1)
        useReconnectStore.getState().setAttempt(attempt)
        log(
          'info',
          `Auto-reconnect: attempt ${String(attempt)}/${String(RECONNECT_MAX_ATTEMPTS)} in ${String(delay)}ms`
        )
        await sleepWithAbort(delay, signal)
        if (isAborted(signal)) return

        const found = await this.scanForDevice(deviceId, signal)
        if (isAborted(signal)) return
        if (!found) {
          log('warn', `Auto-reconnect: device ${deviceId} not seen on attempt ${String(attempt)}`)
          continue
        }

        const outcome = await this.tryConnectAttempt(deviceId, attempt, signal)
        if (outcome === 'aborted' || outcome === 'connected') return
      }

      if (!isAborted(signal)) {
        log('error', 'Auto-reconnect: max attempts reached, giving up')
        useDeviceStore.getState().setError({ kind: 'not-in-range' })
      }
    } finally {
      if (this.reconnectController === controller) {
        this.reconnectController = null
      }
      useReconnectStore.getState().stop()
    }
  }

  private scanForDevice(deviceId: string, signal: AbortSignal): Promise<boolean> {
    return new Promise((resolve) => {
      if (signal.aborted) {
        resolve(false)
        return
      }

      let settled = false
      const finish = (found: boolean) => {
        if (settled) return
        settled = true
        void this.manager.stopDeviceScan()
        signal.removeEventListener('abort', onAbort)
        clearTimeout(timer)
        resolve(found)
      }
      const onAbort = () => {
        finish(false)
      }
      signal.addEventListener('abort', onAbort)

      const timer = setTimeout(() => {
        finish(false)
      }, RECONNECT_SCAN_TIMEOUT_MS)

      void this.manager.startDeviceScan(
        [BLE_SERVICE_UUID],
        { allowDuplicates: false },
        (error, device) => {
          if (error) {
            finish(false)
            return
          }
          if (device?.id === deviceId) {
            finish(true)
          }
        }
      )
    })
  }

  private bindDeviceSubscriptions(device: Device): void {
    this.connectedDevice = device

    this.teleSub = device.monitorCharacteristicForService(
      BLE_SERVICE_UUID,
      BLE_CHAR_TELE,
      (error: Error | null, char: Characteristic | null) => {
        if (error || !char?.value) return
        if (!this.connectedDevice) return
        const payload = parseTelemetry(decodeBase64(char.value))
        if (!payload) {
          log('warn', 'BLE: rejected malformed telemetry payload')
          return
        }
        useSignalsStore.getState().update(payload)
      }
    )

    this.statusSub = device.monitorCharacteristicForService(
      BLE_SERVICE_UUID,
      BLE_CHAR_STATUS,
      (error: Error | null, char: Characteristic | null) => {
        if (error || !char?.value) return
        if (!this.connectedDevice) return
        const result = parseBleStatus(decodeBase64(char.value))
        if (result.kind !== 'ok') {
          log('warn', `BLE: rejected malformed status payload (${result.kind})`)
          return
        }
        const s = result.status
        const store = useDeviceStore.getState()
        store.setFirmwareStatus(s.firmwareVersion ?? '?', s.canHealthy ?? false)
        if (s.isDay !== undefined) store.setIsDayMode(s.isDay)
      }
    )

    this.disconnectSub = device.onDisconnected(() => {
      this.connectedDevice = null
      this.removeSubscriptions()
      this.stopStalenessTimer()
      useDeviceStore.getState().disconnect()
      if (this.userInitiatedDisconnect) {
        log('info', `Disconnected from ${device.id} (user-initiated)`)
        return
      }
      log('warn', `Device ${device.id} disconnected unexpectedly`)
      void this.runReconnectLoop(device.id)
    })
  }

  private handleRestoredState(restoredState: BleRestoredState | null): void {
    if (!restoredState) {
      log('info', 'BLE restore: no prior state (fresh launch)')
      return
    }

    const peripherals = restoredState.connectedPeripherals
    if (peripherals.length === 0) {
      log('info', 'BLE restore: state present but no connected peripherals')
      return
    }

    if (peripherals.length > 1) {
      log('warn', `BLE restore: ${String(peripherals.length)} peripherals restored — using first`)
    }
    const device = peripherals[0]
    if (!device) return

    log('info', `BLE restore: re-binding to ${device.name ?? BLE_DEVICE_NAME} (${device.id})`)

    this.removeSubscriptions()
    this.bindDeviceSubscriptions(device)

    const store = useDeviceStore.getState()
    store.setDevice(device.id, device.name ?? BLE_DEVICE_NAME)
    store.setMode('ble')

    void rememberDevice(device.id)
    useReconnectStore.getState().stop()

    void this.seedStatusFromDevice(device)

    this.startStalenessTimer()
  }

  private async seedStatusFromDevice(
    device: Device,
    setFirmwareStatus: (version: string, canHealthy: boolean) => void = useDeviceStore.getState()
      .setFirmwareStatus
  ): Promise<void> {
    try {
      const statusChar = await this.runGatt(() =>
        device.readCharacteristicForService(BLE_SERVICE_UUID, BLE_CHAR_STATUS)
      )
      if (!statusChar.value) return
      const result = parseBleStatus(decodeBase64(statusChar.value))
      if (result.kind !== 'ok') {
        log('warn', `BLE: rejected malformed initial status payload (${result.kind})`)
        return
      }
      const status = result.status
      setFirmwareStatus(status.firmwareVersion ?? '?', status.canHealthy ?? false)
      const store = useDeviceStore.getState()
      if (status.isDay !== undefined) {
        store.setIsDayMode(status.isDay)
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      log('warn', `BLE: failed to seed STATUS — ${msg}`)
    }
  }

  private startStalenessTimer(): void {
    this.stalenessTimer = setInterval(() => {
      const { lastUpdateMs, isLive } = useSignalsStore.getState()
      if (isLive && Date.now() - lastUpdateMs > STALENESS_THRESHOLD_MS) {
        useSignalsStore.getState().markStale()
      }
    }, STALENESS_CHECK_INTERVAL_MS)
  }

  private stopStalenessTimer(): void {
    if (this.stalenessTimer) {
      clearInterval(this.stalenessTimer)
      this.stalenessTimer = null
    }
  }

  private removeSubscriptions(): void {
    this.teleSub?.remove()
    this.teleSub = null
    this.statusSub?.remove()
    this.statusSub = null
    this.disconnectSub?.remove()
    this.disconnectSub = null
  }

  private async ensureAndroidBlePermissions(): Promise<void> {
    const result = await this.requestAndroidPermissions()
    switch (result.kind) {
      case 'granted':
      case 'not_applicable':
        return
      case 'denied':
      case 'never_ask_again': {
        const err = new Error('android_ble_permission_denied') as Error & {
          code?: string
        }
        err.code = 'android_ble_permission_denied'
        throw err
      }
      default: {
        const _exhaustive: never = result
        return _exhaustive
      }
    }
  }
}

export const bleService = new BleService()

export const scan = bleService.scan.bind(bleService)
export const stopScan = bleService.stopScan.bind(bleService)
export const connect = bleService.connect.bind(bleService)
export const disconnect = bleService.disconnect.bind(bleService)
export const cancelReconnect = bleService.cancelReconnect.bind(bleService)
export const pushSettings = bleService.pushSettings.bind(bleService)
export const readSettings = bleService.readSettings.bind(bleService)
export const sendCmd = bleService.sendCmd.bind(bleService)
export const getBlePermissionState = bleService.getBlePermissionState.bind(bleService)
export const isBlePowered = bleService.isBlePowered.bind(bleService)
export const tryReconnectLastDevice = bleService.tryReconnectLastDevice.bind(bleService)
