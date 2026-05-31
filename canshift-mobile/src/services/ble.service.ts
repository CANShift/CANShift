// ble.service.ts — BLE connection, telemetry subscription, settings/cmd write

import {
  BleManager,
  Device,
  State,
  Characteristic,
  Subscription,
  type BleRestoredState,
} from 'react-native-ble-plx'
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
import { parseTelemetry } from './ble.validators'
import { parseBleStatus } from '@tmbk/canshift-core'
import { decodeBase64, encodeBase64 } from './base64'
import { rememberDevice, forgetDevice, getLastDevice } from './last-device'
import { setWifiApPassword, clearWifiApPassword } from './wifi-ap-password'
import { requestAndroidBlePermissions, type AndroidBlePermissionResult } from './ble-permissions'
import { mapBleError, describeBleError } from './ble.errors'
import { withGattRetry } from './ble.retry'

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface ScanResult {
  id: string
  name: string
}

/** Extra payload fields to send alongside the command name. */
export type CmdPayload = Record<string, boolean | number | string>

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

// ---------------------------------------------------------------------------
// Auto-reconnect tuning (module-level constants)
// ---------------------------------------------------------------------------

/**
 * iOS-only: stable identifier the OS uses to associate restored BLE state with
 * this app's central manager across background/relaunch cycles. Must remain
 * stable for the app's lifetime — changing it discards any pending restoration.
 */
const BLE_RESTORE_STATE_IDENTIFIER = 'canshift.ble.central'

const RECONNECT_INITIAL_DELAY_MS = 1_000
const RECONNECT_MAX_DELAY_MS = 30_000
const RECONNECT_BACKOFF_FACTOR = 2
const RECONNECT_JITTER_RATIO = 0.2
const RECONNECT_MAX_ATTEMPTS = 6
const RECONNECT_SCAN_TIMEOUT_MS = 5_000
const STALENESS_CHECK_INTERVAL_MS = 500
const STALENESS_THRESHOLD_MS = 2_000

// ---------------------------------------------------------------------------
// Pure helpers (no instance state)
// ---------------------------------------------------------------------------

/** Opaque read so the TS narrower doesn't treat `signal.aborted` as constant
 *  across awaits — it can flip between yields. */
function isAborted(signal: AbortSignal): boolean {
  return signal.aborted
}

function computeBackoffDelay(attempt: number): number {
  const exponential = RECONNECT_INITIAL_DELAY_MS * Math.pow(RECONNECT_BACKOFF_FACTOR, attempt)
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

function currentPlatform(): 'ios' | 'android' {
  return Platform.OS === 'android' ? 'android' : 'ios'
}

// ---------------------------------------------------------------------------
// BleService — owner-controlled lifecycle, dependency-injectable for tests.
// ---------------------------------------------------------------------------

/** Constructor-injected dependencies. Defaults match production wiring. */
export interface BleServiceDeps {
  /** Factory for the underlying `BleManager`. Tests can return a stub. */
  managerFactory?: () => BleManager
  /** Android runtime permission requester. Tests can return canned results. */
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

  /**
   * Set true by `disconnect()` before any cleanup. The SDK may fire the
   * `onDisconnected` callback after `cancelConnection()` resolves; the
   * handler at construction time can't tell whether a disconnect was
   * user-initiated (intentional) or driver-initiated (link drop) without
   * this flag. Without it, the reconnect loop re-arms even when the user
   * explicitly chose to disconnect. Cleared when a fresh `connect()` runs
   * (#1017 M-LO-2).
   */
  private userInitiatedDisconnect = false

  /**
   * FIFO serializer for GATT request/response operations (read + write).
   * Concurrent reads/writes against the same `Device` race in the underlying
   * stack and silently drop or reorder; chaining them through this single
   * promise guarantees one-at-a-time execution while keeping each caller's
   * resolved/rejected value isolated.
   *
   * Notification subscriptions are *not* routed through this queue — they're
   * stream registrations, not request/response, and can run concurrently.
   */
  private gattQueue: Promise<unknown> = Promise.resolve()

  /**
   * Schedule a GATT operation behind every previously-queued one. The returned
   * promise mirrors the operation's outcome; the queue itself swallows
   * rejections so a failed op cannot poison subsequent ones.
   */
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
          // iOS BLE state restoration: when the OS relaunches the app after a
          // BLE event in the background, it hands back any peripherals that
          // were connected at suspension time. Without this, every foreground
          // cycle triggers a fresh scan+connect.
          restoreStateIdentifier: BLE_RESTORE_STATE_IDENTIFIER,
          restoreStateFunction: (restoredState) => {
            this.handleRestoredState(restoredState)
          },
        }))
    this.manager = factory()
    this.requestAndroidPermissions = deps.requestAndroidPermissions ?? requestAndroidBlePermissions
  }

  // -------------------------------------------------------------------------
  // Lifecycle
  // -------------------------------------------------------------------------

  /**
   * Tear down all listeners, timers, and the underlying `BleManager`.
   * The instance is unusable afterwards. Intended for tests; production code
   * keeps the singleton alive for the app's lifetime.
   */
  async dispose(): Promise<void> {
    this.cancelReconnect()
    this.stopStalenessTimer()
    this.removeSubscriptions()
    if (this.connectedDevice) {
      try {
        await this.connectedDevice.cancelConnection()
      } catch {
        // best-effort
      }
      this.connectedDevice = null
    }
    await this.manager.destroy()
  }

  // -------------------------------------------------------------------------
  // Scan
  // -------------------------------------------------------------------------

  /** Scan for CANShift BLE devices. Returns list of found devices after timeoutMs. */
  async scan(onFound: (device: ScanResult) => void, timeoutMs = 10000): Promise<void> {
    // Android 12+: must request runtime BLE permissions before scanning.
    // No-op on iOS and Android < 12.
    await this.ensureAndroidBlePermissions()
    // A user-initiated scan implies they want to control connections themselves.
    this.cancelReconnect()
    return new Promise((resolve, reject) => {
      const found = new Set<string>()
      let settled = false
      let timer: ReturnType<typeof setTimeout> | null = null

      // startDeviceScan / stopDeviceScan are typed as Promise-returning by the
      // SDK but used here as fire-and-forget — `void` makes that explicit.
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

  /** Stop an ongoing scan. */
  stopScan(): void {
    void this.manager.stopDeviceScan()
  }

  // -------------------------------------------------------------------------
  // Connection
  // -------------------------------------------------------------------------

  /** Connect to a device and subscribe to telemetry notifications. */
  async connect(deviceId: string): Promise<void> {
    const { setConnectionState, setDevice, setFirmwareStatus, setError } = useDeviceStore.getState()

    // Android 12+: must request runtime BLE permissions before connecting.
    // No-op on iOS and Android < 12. Errors propagate to the caller.
    await this.ensureAndroidBlePermissions()

    setConnectionState('connecting')
    log('info', `Connecting to device ${deviceId}`)

    // Reset the user-initiated-disconnect flag so a fresh connect after a
    // previous user-initiated disconnect can re-arm auto-reconnect on the
    // next link drop (#1017 M-LO-2).
    this.userInitiatedDisconnect = false

    // Defensive: clear any leftover subscriptions from a prior connect attempt.
    this.removeSubscriptions()

    try {
      const device = await this.manager.connectToDevice(deviceId, { autoConnect: false })
      await device.discoverAllServicesAndCharacteristics()
      this.connectedDevice = device

      // Read STATUS characteristic so firmwareVersion/canHealthy/wifiAp/isDayMode
      // are seeded before any UI subscribes — shared with the iOS restore path
      // (#773) so both entry points produce the same observable store state.
      await this.seedStatusFromDevice(device, setFirmwareStatus)

      setDevice(deviceId, device.name ?? BLE_DEVICE_NAME)
      useDeviceStore.getState().setMode('ble')
      log('info', `Connected to ${device.name ?? BLE_DEVICE_NAME} (${deviceId})`)

      // Persist for auto-reconnect on next launch / drop. Fire-and-forget.
      void rememberDevice(deviceId)
      // A successful connect supersedes any in-flight reconnect loop.
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

  /** Disconnect from the current device. Forgets the device and cancels any
   *  in-flight auto-reconnect — explicit user intent overrides persistence. */
  async disconnect(): Promise<void> {
    // Flag the disconnect as user-initiated BEFORE doing any cleanup so the
    // onDisconnected callback at line ~621 (if it still fires after we
    // remove subscriptions — the SDK doesn't guarantee a synchronous
    // teardown) can short-circuit instead of re-arming the reconnect loop.
    // Cleared when a fresh connect() runs (#1017 M-LO-2).
    this.userInitiatedDisconnect = true
    this.cancelReconnect()
    this.stopStalenessTimer()
    // Remove subscriptions BEFORE cancelConnection so the SDK's disconnect
    // callback doesn't fire into a still-registered handler.
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
    await clearWifiApPassword()
  }

  // -------------------------------------------------------------------------
  // Settings / commands
  // -------------------------------------------------------------------------

  /** Push screen settings to the device. */
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

  /**
   * Read the current screen settings from the device.
   * Returns null if the characteristic value is missing or unparseable.
   */
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

  /** Send a command to the device. Optional `payload` is merged into the JSON. */
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

  /**
   * @internal Test seam: inject a stub `Device` so unit tests can exercise
   * `pushSettings` / `sendCmd` / `readSettings` without going through a real
   * `connect()` flow. Not part of the public API; the underscore prefix and
   * `@internal` tag mark it as such.
   */
  _test_setConnectedDevice(device: Device | null): void {
    this.connectedDevice = device
  }

  // -------------------------------------------------------------------------
  // Permission / adapter state
  // -------------------------------------------------------------------------

  /** Classify the current adapter state for UI consumers. */
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

  /** Check if BLE is powered on. Returns true if ready. */
  async isBlePowered(): Promise<boolean> {
    const state = await this.manager.state()
    return state === State.PoweredOn
  }

  // -------------------------------------------------------------------------
  // Auto-reconnect
  // -------------------------------------------------------------------------

  /**
   * Cancel any in-flight reconnect loop. Safe to call when nothing is running.
   * Also clears the reconnect store and any leftover scan.
   */
  cancelReconnect(): void {
    if (this.reconnectController) {
      this.reconnectController.abort()
      this.reconnectController = null
    }
    void this.manager.stopDeviceScan()
    useReconnectStore.getState().stop()
  }

  /**
   * Attempt to reconnect to the last-known device, if one is persisted and BLE
   * is ready. Returns true if a reconnect loop was started, false otherwise.
   * Safe to call at app startup.
   */
  async tryReconnectLastDevice(): Promise<boolean> {
    if (!(await this.isBlePowered())) return false
    const lastId = await getLastDevice()
    if (!lastId) return false
    void this.runReconnectLoop(lastId)
    return true
  }

  /**
   * Attempt to reconnect to `deviceId` with bounded exponential backoff + jitter.
   * Cancelable via `cancelReconnect()`. Only one loop runs at a time — additional
   * calls while a loop is active are ignored.
   */
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

        try {
          await this.connect(deviceId)
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
        useDeviceStore.getState().setError({ kind: 'not-in-range' })
      }
    } finally {
      if (this.reconnectController === controller) {
        this.reconnectController = null
      }
      useReconnectStore.getState().stop()
    }
  }

  /**
   * Briefly scan for `deviceId` and return true if the device is observed.
   * Resolves false on timeout or abort.
   */
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

  // -------------------------------------------------------------------------
  // Internal state helpers
  // -------------------------------------------------------------------------

  /**
   * Bind TELE / STATUS / disconnect listeners to an already-connected device
   * and record it as the current connection. Shared between the fresh-connect
   * path and the iOS state-restoration path.
   */
  private bindDeviceSubscriptions(device: Device): void {
    this.connectedDevice = device

    this.teleSub = device.monitorCharacteristicForService(
      BLE_SERVICE_UUID,
      BLE_CHAR_TELE,
      (error: Error | null, char: Characteristic | null) => {
        if (error || !char?.value) return
        // Guard against in-flight notifications arriving after disconnect.
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
        // Guard against in-flight notifications arriving after disconnect.
        if (!this.connectedDevice) return
        const result = parseBleStatus(decodeBase64(char.value))
        if (result.kind !== 'ok') {
          log('warn', `BLE: rejected malformed status payload (${result.kind})`)
          return
        }
        const s = result.status
        const store = useDeviceStore.getState()
        store.setFirmwareStatus(s.firmwareVersion ?? '?', s.canHealthy ?? false)
        store.setWifiApSsid(s.apSsid ?? null)
        void setWifiApPassword(s.apPassword ?? null)
        if (s.isDay !== undefined) store.setIsDayMode(s.isDay)
      }
    )

    this.disconnectSub = device.onDisconnected(() => {
      // Null connectedDevice first so any in-flight TELE/STATUS callbacks
      // short-circuit before removeSubscriptions() returns (#1166).
      this.connectedDevice = null
      this.removeSubscriptions()
      this.stopStalenessTimer()
      useDeviceStore.getState().disconnect()
      // If the user (or anything inside `disconnect()`) initiated this
      // teardown, do NOT re-arm the reconnect loop — explicit intent wins
      // (#1017 M-LO-2). The flag is reset by the next successful connect().
      if (this.userInitiatedDisconnect) {
        log('info', `Disconnected from ${device.id} (user-initiated)`)
        return
      }
      log('warn', `Device ${device.id} disconnected unexpectedly`)
      void this.runReconnectLoop(device.id)
    })
  }

  /**
   * iOS-only: invoked by `BleManager` shortly after construction when the OS
   * is handing back peripherals that were connected at suspension time.
   *
   * Strategy:
   *  - If iOS returned a connected peripheral, re-bind subscriptions to it and
   *    seed the device store so the UI reflects the restored connection
   *    without going through scan → connect.
   *  - If nothing was restored, fall through silently — the existing
   *    foreground-reconnect path handles the connect-on-demand case.
   */
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

    // Multiple connected peripherals is not a flow CANShift supports today —
    // we only ever bond to one dashboard at a time. Take the first and log if
    // there's more than one for future debugging.
    if (peripherals.length > 1) {
      log('warn', `BLE restore: ${String(peripherals.length)} peripherals restored — using first`)
    }
    const device = peripherals[0]
    if (!device) return

    log('info', `BLE restore: re-binding to ${device.name ?? BLE_DEVICE_NAME} (${device.id})`)

    // Defensive: clear any subscriptions left from a prior session before
    // re-binding to the restored device.
    this.removeSubscriptions()
    this.bindDeviceSubscriptions(device)

    const store = useDeviceStore.getState()
    store.setDevice(device.id, device.name ?? BLE_DEVICE_NAME)
    // Mirror the fresh-connect flow: without this any UI gated on `mode === 'ble'`
    // (top-bar SIM badge, future mode-based branches) misclassifies the
    // restored session as idle (#773).
    store.setMode('ble')

    // Persist as last-known device so the foreground-reconnect fallback can
    // also find it if the OS later drops the link.
    void rememberDevice(device.id)
    // Any in-flight reconnect from a prior session is now moot.
    useReconnectStore.getState().stop()

    // Seed firmware/CAN/WiFi/Day-Night state from STATUS so the dashboard
    // doesn't render `v?` / `CAN ○` / wrong theme until the next notification
    // arrives. Fire-and-forget — failures fall back to the next notify (#773).
    void this.seedStatusFromDevice(device)

    this.startStalenessTimer()
  }

  /**
   * Read STATUS once and seed firmwareVersion / canHealthy / wifiAp / isDayMode
   * into the device store. Shared by `connect()` (fresh foreground connect)
   * and `handleRestoredState()` (iOS background-restore) so both paths produce
   * the same observable state — #773.
   */
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
      store.setWifiApSsid(status.apSsid ?? null)
      void setWifiApPassword(status.apPassword ?? null)
      if (status.isDay !== undefined) {
        store.setIsDayMode(status.isDay)
      }
    } catch (err) {
      // Best-effort — the seed is a UX nicety. If the read fails the next
      // notification will populate the store; don't fail the restore path.
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

  /**
   * Ensure Android 12+ runtime BLE permissions are granted before a BLE op.
   * No-op on iOS and Android < 12. Throws a tagged error on denial so callers
   * (and the UI) can surface platform-specific copy.
   */
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

// ---------------------------------------------------------------------------
// App-wide singleton + free-function shims for source-compatible call sites.
// Tests can construct their own `new BleService(...)` with stubbed deps.
// ---------------------------------------------------------------------------

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
