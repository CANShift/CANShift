// ble.service.ts — BLE connection, telemetry subscription, settings/cmd write

import { BleManager, Device, State, Characteristic } from 'react-native-ble-plx'
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

// ---------------------------------------------------------------------------
// Singleton BleManager
// ---------------------------------------------------------------------------

const manager = new BleManager()
let connectedDevice: Device | null = null
let stalenessTimer: ReturnType<typeof setInterval> | null = null

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function decodeBase64(value: string): string {
  return Buffer.from(value, 'base64').toString('utf8')
}

function encodeBase64(value: string): string {
  return Buffer.from(value, 'utf8').toString('base64')
}

function parseTelemetry(raw: string): Record<string, number> {
  try {
    return JSON.parse(raw) as Record<string, number>
  } catch {
    return {}
  }
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
      const status = JSON.parse(decodeBase64(statusChar.value)) as {
        ver?: string
        can?: number
        is_day?: number
      }
      setFirmwareStatus(status.ver ?? '?', (status.can ?? 0) === 1)
      if (status.is_day !== undefined) {
        useDeviceStore.getState().setIsDayMode(status.is_day === 1)
      }
    }

    setDevice(deviceId, device.name ?? BLE_DEVICE_NAME)
    log('info', `Connected to ${device.name ?? BLE_DEVICE_NAME} (${deviceId})`)

    // Subscribe to TELE notifications
    device.monitorCharacteristicForService(
      BLE_SERVICE_UUID,
      BLE_CHAR_TELE,
      (error: Error | null, char: Characteristic | null) => {
        if (error || !char?.value) return
        const payload = parseTelemetry(decodeBase64(char.value))
        useSignalsStore.getState().update(payload)
      }
    )

    // Subscribe to STATUS notifications
    device.monitorCharacteristicForService(
      BLE_SERVICE_UUID,
      BLE_CHAR_STATUS,
      (error: Error | null, char: Characteristic | null) => {
        if (error || !char?.value) return
        try {
          const s = JSON.parse(decodeBase64(char.value)) as {
            ver?: string
            can?: number
            ap_ssid?: string
            is_day?: number
          }
          const store = useDeviceStore.getState()
          store.setFirmwareStatus(s.ver ?? '?', (s.can ?? 0) === 1)
          store.setWifiAp(s.ap_ssid ?? null)
          if (s.is_day !== undefined) store.setIsDayMode(s.is_day === 1)
        } catch {
          // Drop malformed status payloads silently — the next valid one wins.
        }
      }
    )

    // Handle unexpected disconnection
    device.onDisconnected(() => {
      connectedDevice = null
      stopStalenessTimer()
      useDeviceStore.getState().disconnect()
      log('warn', `Device ${deviceId} disconnected unexpectedly`)
    })

    startStalenesTimer()
  } catch (err) {
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

/** Check if BLE is powered on. Returns true if ready. */
export async function isBlePowered(): Promise<boolean> {
  const state = await manager.state()
  return state === State.PoweredOn
}
