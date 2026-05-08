// ble.service.ts — BLE connection, telemetry subscription, settings/cmd write

import { BleManager, Device, State, Characteristic, Subscription } from 'react-native-ble-plx'
import { Buffer } from 'buffer'
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
import { parseTelemetry, parseStatus } from './ble.validators'

// ---------------------------------------------------------------------------
// Singleton BleManager
// ---------------------------------------------------------------------------

const manager = new BleManager()
let connectedDevice: Device | null = null
let stalenessTimer: ReturnType<typeof setInterval> | null = null
let teleSub: Subscription | null = null
let statusSub: Subscription | null = null
let disconnectSub: Subscription | null = null

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function decodeBase64(value: string): string {
  return Buffer.from(value, 'base64').toString('utf8')
}

function encodeBase64(value: string): string {
  return Buffer.from(value, 'utf8').toString('base64')
}

function startStalenesTimer() {
  stalenessTimer = setInterval(() => {
    const { lastUpdateMs, isLive } = useSignalsStore.getState()
    if (isLive && Date.now() - lastUpdateMs > 2000) {
      useSignalsStore.getState().markStale()
    }
  }, 500)
}

function stopStalenessTimer() {
  if (stalenessTimer) {
    clearInterval(stalenessTimer)
    stalenessTimer = null
  }
}

function removeSubscriptions() {
  teleSub?.remove()
  teleSub = null
  statusSub?.remove()
  statusSub = null
  disconnectSub?.remove()
  disconnectSub = null
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface ScanResult { id: string; name: string }

/** Scan for CANShift BLE devices. Returns list of found devices after timeoutMs. */
export function scan(
  onFound: (device: ScanResult) => void,
  timeoutMs = 10000
): Promise<void> {
  return new Promise((resolve, reject) => {
    const found = new Set<string>()

    // startDeviceScan / stopDeviceScan are typed as Promise-returning by the
    // SDK but used here as fire-and-forget — `void` makes that explicit.
    void manager.startDeviceScan(
      [BLE_SERVICE_UUID],
      { allowDuplicates: false },
      (error, device) => {
        if (error) {
          void manager.stopDeviceScan()
          reject(new Error(error.message))
          return
        }
        if (device?.name?.includes(BLE_DEVICE_NAME) && !found.has(device.id)) {
          found.add(device.id)
          onFound({ id: device.id, name: device.name })
        }
      }
    )

    setTimeout(() => {
      void manager.stopDeviceScan()
      resolve()
    }, timeoutMs)
  })
}

/** Stop an ongoing scan. */
export function stopScan() {
  void manager.stopDeviceScan()
}

/** Connect to a device and subscribe to telemetry notifications. */
export async function connect(deviceId: string): Promise<void> {
  const { setConnectionState, setDevice, setFirmwareStatus, setError } =
    useDeviceStore.getState()

  setConnectionState('connecting')
  log('info', `Connecting to device ${deviceId}`)

  // Defensive: clear any leftover subscriptions from a prior connect attempt.
  removeSubscriptions()

  try {
    const device = await manager.connectToDevice(deviceId, { autoConnect: false })
    await device.discoverAllServicesAndCharacteristics()
    connectedDevice = device

    // Read STATUS characteristic
    const statusChar = await device.readCharacteristicForService(
      BLE_SERVICE_UUID,
      BLE_CHAR_STATUS
    )
    if (statusChar.value) {
      const status = parseStatus(decodeBase64(statusChar.value))
      if (status) {
        setFirmwareStatus(status.ver ?? '?', (status.can ?? 0) === 1)
        if (status.is_day !== undefined) {
          useDeviceStore.getState().setIsDayMode(status.is_day === 1)
        }
      } else {
        log('warn', 'BLE: rejected malformed initial status payload')
      }
    }

    setDevice(deviceId, device.name ?? BLE_DEVICE_NAME)
    log('info', `Connected to ${device.name ?? BLE_DEVICE_NAME} (${deviceId})`)

    // Subscribe to TELE notifications
    teleSub = device.monitorCharacteristicForService(
      BLE_SERVICE_UUID,
      BLE_CHAR_TELE,
      (error: Error | null, char: Characteristic | null) => {
        if (error || !char?.value) return
        const payload = parseTelemetry(decodeBase64(char.value))
        if (!payload) {
          log('warn', 'BLE: rejected malformed telemetry payload')
          return
        }
        useSignalsStore.getState().update(payload)
      }
    )

    // Subscribe to STATUS notifications
    statusSub = device.monitorCharacteristicForService(
      BLE_SERVICE_UUID,
      BLE_CHAR_STATUS,
      (error: Error | null, char: Characteristic | null) => {
        if (error || !char?.value) return
        const s = parseStatus(decodeBase64(char.value))
        if (!s) {
          log('warn', 'BLE: rejected malformed status payload')
          return
        }
        const store = useDeviceStore.getState()
        store.setFirmwareStatus(s.ver ?? '?', (s.can ?? 0) === 1)
        store.setWifiAp(s.ap_ssid ?? null)
        if (s.is_day !== undefined) store.setIsDayMode(s.is_day === 1)
      }
    )

    // Handle unexpected disconnection
    disconnectSub = device.onDisconnected(() => {
      removeSubscriptions()
      stopStalenessTimer()
      connectedDevice = null
      useDeviceStore.getState().disconnect()
      log('warn', `Device ${deviceId} disconnected unexpectedly`)
    })

    startStalenesTimer()
  } catch (err) {
    removeSubscriptions()
    connectedDevice = null
    const msg = err instanceof Error ? err.message : 'Connection failed'
    setError(msg)
    log('error', `Connection failed: ${msg}`)
    throw err
  }
}

/** Disconnect from the current device. */
export async function disconnect(): Promise<void> {
  stopStalenessTimer()
  // Remove subscriptions BEFORE cancelConnection so the SDK's disconnect
  // callback doesn't fire into a still-registered handler.
  removeSubscriptions()
  if (connectedDevice) {
    const id = connectedDevice.id
    await connectedDevice.cancelConnection()
    connectedDevice = null
    log('info', `Disconnected from ${id}`)
  }
  clearBuffer()
  useDeviceStore.getState().disconnect()
}

/** Push screen settings to the device. */
export async function pushSettings(settings: {
  brightness: number
  sleep: number
}): Promise<void> {
  if (!connectedDevice) throw new Error('Not connected')
  const json = JSON.stringify(settings)
  await connectedDevice.writeCharacteristicWithResponseForService(
    BLE_SERVICE_UUID,
    BLE_CHAR_SETTINGS,
    encodeBase64(json)
  )
}

/**
 * Read the current screen settings from the device.
 * Returns null if the characteristic value is missing or unparseable.
 */
export async function readSettings(): Promise<{ brightness: number; sleep: number } | null> {
  if (!connectedDevice) throw new Error('Not connected')
  const char = await connectedDevice.readCharacteristicForService(
    BLE_SERVICE_UUID,
    BLE_CHAR_SETTINGS
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

/** Send a command to the device. */
export async function sendCmd(cmd: string): Promise<void> {
  if (!connectedDevice) throw new Error('Not connected')
  const json = JSON.stringify({ cmd })
  await connectedDevice.writeCharacteristicWithoutResponseForService(
    BLE_SERVICE_UUID,
    BLE_CHAR_CMD,
    encodeBase64(json)
  )
}

/**
 * Discriminated state describing whether the app can use BLE right now.
 * Mirrors `react-native-ble-plx`'s `State` enum but collapses the cases the
 * UI cares about and adds a value the UI can switch on exhaustively.
 */
export type BlePermissionState =
  | { kind: 'ok' }
  | { kind: 'powered_off' }
  | { kind: 'unauthorized' }
  | { kind: 'unsupported' }
  | { kind: 'resetting' }
  | { kind: 'unknown' }

/** Classify the current adapter state for UI consumers. */
export async function getBlePermissionState(): Promise<BlePermissionState> {
  const state = await manager.state()
  switch (state) {
    case State.PoweredOn:
      return { kind: 'ok' }
    case State.PoweredOff:
      return { kind: 'powered_off' }
    case State.Unauthorized:
      return { kind: 'unauthorized' }
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

/** Check if BLE is powered on. Returns true if ready. */
export async function isBlePowered(): Promise<boolean> {
  const state = await manager.state()
  return state === State.PoweredOn
}
