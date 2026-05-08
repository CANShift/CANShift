// ble.service.ts — BLE connection, telemetry subscription, settings/cmd write

import { BleManager, Device, State, Characteristic, Subscription } from 'react-native-ble-plx'
import { Buffer } from 'buffer'
import { Platform } from 'react-native'
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
import { parseTelemetry, parseStatus } from './ble.validators'
import { rememberDevice, forgetDevice, getLastDevice } from './last-device'
import { requestAndroidBlePermissions } from './ble-permissions'

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
// Auto-reconnect state (module-level singleton, only one loop at a time)
// ---------------------------------------------------------------------------

const RECONNECT_INITIAL_DELAY_MS = 1_000
const RECONNECT_MAX_DELAY_MS = 30_000
const RECONNECT_BACKOFF_FACTOR = 2
const RECONNECT_JITTER_RATIO = 0.2
const RECONNECT_MAX_ATTEMPTS = 6
const RECONNECT_SCAN_TIMEOUT_MS = 5_000

let reconnectController: AbortController | null = null

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
// Reconnect helpers
// ---------------------------------------------------------------------------

/** Opaque read so the TS narrower doesn't treat `signal.aborted` as constant
 *  across awaits — it can flip between yields. */
function isAborted(signal: AbortSignal): boolean {
  return signal.aborted
}

function computeBackoffDelay(attempt: number): number {
  const exponential =
    RECONNECT_INITIAL_DELAY_MS * Math.pow(RECONNECT_BACKOFF_FACTOR, attempt)
  const capped = Math.min(exponential, RECONNECT_MAX_DELAY_MS)
  const jitter = capped * RECONNECT_JITTER_RATIO * (Math.random() * 2 - 1)
  return Math.max(0, Math.round(capped + jitter))
}

/** Sleep that resolves early if the abort signal fires. */
function sleepWithAbort(ms: number, signal: AbortSignal): Promise<void> {
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

/**
 * Briefly scan for `deviceId` and return true if the device is observed.
 * Resolves false on timeout or abort.
 */
function scanForDevice(deviceId: string, signal: AbortSignal): Promise<boolean> {
  return new Promise((resolve) => {
    if (signal.aborted) {
      resolve(false)
      return
    }

    let settled = false
    const finish = (found: boolean) => {
      if (settled) return
      settled = true
      void manager.stopDeviceScan()
      signal.removeEventListener('abort', onAbort)
      clearTimeout(timer)
      resolve(found)
    }
    const onAbort = () => { finish(false) }
    signal.addEventListener('abort', onAbort)

    const timer = setTimeout(() => { finish(false) }, RECONNECT_SCAN_TIMEOUT_MS)

    void manager.startDeviceScan(
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

/**
 * Cancel any in-flight reconnect loop. Safe to call when nothing is running.
 * Also clears the reconnect store and any leftover scan.
 */
export function cancelReconnect(): void {
  if (reconnectController) {
    reconnectController.abort()
    reconnectController = null
  }
  void manager.stopDeviceScan()
  useReconnectStore.getState().stop()
}

/**
 * Attempt to reconnect to `deviceId` with bounded exponential backoff + jitter.
 * Cancelable via `cancelReconnect()`. Only one loop runs at a time — additional
 * calls while a loop is active are ignored.
 */
async function runReconnectLoop(deviceId: string): Promise<void> {
  if (reconnectController) {
    log('warn', 'Reconnect loop already running — ignoring duplicate trigger')
    return
  }

  const controller = new AbortController()
  reconnectController = controller
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

      const found = await scanForDevice(deviceId, signal)
      if (isAborted(signal)) return
      if (!found) {
        log('warn', `Auto-reconnect: device ${deviceId} not seen on attempt ${String(attempt)}`)
        continue
      }

      try {
        await connect(deviceId)
        if (isAborted(signal)) return
        log('info', `Auto-reconnect: succeeded on attempt ${String(attempt)}`)
        return
      } catch (err) {
        if (isAborted(signal)) return
        const msg = err instanceof Error ? err.message : 'unknown error'
        log('warn', `Auto-reconnect: connect failed on attempt ${String(attempt)}: ${msg}`)
      }
    }

    if (!isAborted(signal)) {
      log('error', 'Auto-reconnect: max attempts reached, giving up')
      useDeviceStore.getState().setError('Reconnect failed')
    }
  } finally {
    if (reconnectController === controller) {
      reconnectController = null
    }
    useReconnectStore.getState().stop()
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface ScanResult { id: string; name: string }

/** Scan for CANShift BLE devices. Returns list of found devices after timeoutMs. */
export async function scan(
  onFound: (device: ScanResult) => void,
  timeoutMs = 10000
): Promise<void> {
  // Android 12+: must request runtime BLE permissions before scanning.
  // No-op on iOS and Android < 12.
  await ensureAndroidBlePermissions()
  // A user-initiated scan implies they want to control connections themselves.
  cancelReconnect()
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

  // Android 12+: must request runtime BLE permissions before connecting.
  // No-op on iOS and Android < 12. Errors propagate to the caller.
  await ensureAndroidBlePermissions()

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

    // Persist for auto-reconnect on next launch / drop. Fire-and-forget.
    void rememberDevice(deviceId)
    // A successful connect supersedes any in-flight reconnect loop.
    useReconnectStore.getState().stop()

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

    // Handle unexpected disconnection — kick off the auto-reconnect loop.
    disconnectSub = device.onDisconnected(() => {
      removeSubscriptions()
      stopStalenessTimer()
      connectedDevice = null
      useDeviceStore.getState().disconnect()
      log('warn', `Device ${deviceId} disconnected unexpectedly`)
      // If a loop is already running (e.g. rapid bounce), runReconnectLoop
      // is a no-op; otherwise it starts a fresh bounded backoff sequence.
      void runReconnectLoop(deviceId)
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

/** Disconnect from the current device. Forgets the device and cancels any
 *  in-flight auto-reconnect — explicit user intent overrides persistence. */
export async function disconnect(): Promise<void> {
  cancelReconnect()
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
  await forgetDevice()
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

/** Extra payload fields to send alongside the command name. */
export type CmdPayload = Record<string, boolean | number | string>

/** Send a command to the device. Optional `payload` is merged into the JSON. */
export async function sendCmd(cmd: string, payload?: CmdPayload): Promise<void> {
  if (!connectedDevice) throw new Error('Not connected')
  const body: Record<string, boolean | number | string> = { cmd, ...(payload ?? {}) }
  const json = JSON.stringify(body)
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
 *
 * The `unauthorized` variant carries a `platform` tag so the UI can render
 * platform-appropriate copy and CTAs (iOS Settings vs Android nearby-devices).
 */
export type BlePermissionState =
  | { kind: 'ok' }
  | { kind: 'powered_off' }
  | { kind: 'unauthorized'; platform: 'ios' | 'android' }
  | { kind: 'unsupported' }
  | { kind: 'resetting' }
  | { kind: 'unknown' }

function currentPlatform(): 'ios' | 'android' {
  return Platform.OS === 'android' ? 'android' : 'ios'
}

/** Classify the current adapter state for UI consumers. */
export async function getBlePermissionState(): Promise<BlePermissionState> {
  const state = await manager.state()
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

/**
 * Ensure Android 12+ runtime BLE permissions are granted before a BLE op.
 * No-op on iOS and Android < 12. Throws a tagged error on denial so callers
 * (and the UI) can surface platform-specific copy.
 */
async function ensureAndroidBlePermissions(): Promise<void> {
  const result = await requestAndroidBlePermissions()
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

/** Check if BLE is powered on. Returns true if ready. */
export async function isBlePowered(): Promise<boolean> {
  const state = await manager.state()
  return state === State.PoweredOn
}

/**
 * Attempt to reconnect to the last-known device, if one is persisted and BLE
 * is ready. Returns true if a reconnect loop was started, false otherwise.
 * Safe to call at app startup.
 */
export async function tryReconnectLastDevice(): Promise<boolean> {
  if (!(await isBlePowered())) return false
  const lastId = await getLastDevice()
  if (!lastId) return false
  void runReconnectLoop(lastId)
  return true
}
