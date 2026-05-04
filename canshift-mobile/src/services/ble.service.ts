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

export type ScanResult = { id: string; name: string }

/** Scan for CANShift BLE devices. Returns list of found devices after timeoutMs. */
export function scan(
  onFound: (device: ScanResult) => void,
  timeoutMs = 10000
): Promise<void> {
  return new Promise((resolve, reject) => {
    const found = new Set<string>()

    manager.startDeviceScan(
      [BLE_SERVICE_UUID],
      { allowDuplicates: false },
      (error, device) => {
        if (error) {
          manager.stopDeviceScan()
          reject(new Error(error.message))
          return
        }
        if (device && device.name?.includes(BLE_DEVICE_NAME) && !found.has(device.id)) {
          found.add(device.id)
          onFound({ id: device.id, name: device.name ?? BLE_DEVICE_NAME })
        }
      }
    )

    setTimeout(() => {
      manager.stopDeviceScan()
      resolve()
    }, timeoutMs)
  })
}

/** Stop an ongoing scan. */
export function stopScan() {
  manager.stopDeviceScan()
}

/** Connect to a device and subscribe to telemetry notifications. */
export async function connect(deviceId: string): Promise<void> {
  const { setConnectionState, setDevice, setFirmwareStatus, setError } =
    useDeviceStore.getState()

  setConnectionState('connecting')

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
      }
      setFirmwareStatus(status.ver ?? '?', (status.can ?? 0) === 1)
    }

    setDevice(deviceId, device.name ?? BLE_DEVICE_NAME)

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

    // Handle unexpected disconnection
    device.onDisconnected(() => {
      connectedDevice = null
      stopStalenessTimer()
      useDeviceStore.getState().disconnect()
    })

    startStalenesTimer()
  } catch (err) {
    connectedDevice = null
    const msg = err instanceof Error ? err.message : 'Connection failed'
    setError(msg)
    throw err
  }
}

/** Disconnect from the current device. */
export async function disconnect(): Promise<void> {
  stopStalenessTimer()
  if (connectedDevice) {
    await connectedDevice.cancelConnection()
    connectedDevice = null
  }
  useDeviceStore.getState().disconnect()
}

/** Push screen settings to the device. */
export async function pushSettings(settings: {
  brightness: number
  sleep: number
  rotation: 0 | 90 | 180 | 270
}): Promise<void> {
  if (!connectedDevice) throw new Error('Not connected')
  const json = JSON.stringify(settings)
  await connectedDevice.writeCharacteristicWithResponseForService(
    BLE_SERVICE_UUID,
    BLE_CHAR_SETTINGS,
    encodeBase64(json)
  )
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
