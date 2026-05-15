// ipc.service.ts — Type-safe wrapper around the Electron IPC bridge.
// All renderer → main communication goes through here.

import type {
  DashboardConfig,
  SignalConfig,
  DeviceConfig,
  ConnectionStatus,
  LatestReleaseResult,
  OpenResult,
  PortInfo,
  SaveResult,
  UsbResult,
} from '@tmbk/canshift-core'
import { IpcChannels } from '../../shared/ipc-channels'
import type { FirmwareRelease } from '../../shared/firmware.service.types'
import type { CanFrame, CanHealth } from '../../shared/usb.service.types'
import type {
  UpdateAvailablePayload,
  UpdateErrorPayload,
} from '../../shared/updater.service.types'

// Studio-local IPC payload types (not part of canshift-core). Core IPC return
// shapes (PortInfo, ConnectionStatus, UsbResult, OpenResult, SaveResult) are
// imported directly from '@tmbk/canshift-core' at every call site — do not
// re-export them through this barrel.
export type { FirmwareRelease, CanFrame, CanHealth, UpdateAvailablePayload, UpdateErrorPayload }

/**
 * Renderer-side mirror of the `queryVersion()` payload. Kept as a type alias
 * so renderer call sites and tests don't reach into `main/services` directly.
 */
export interface FirmwareStatus {
  version: string | null
  isDay: boolean | null
}

/**
 * Shape of the `USB_DEVICE_LOG` IPC payload — `level` is the raw firmware
 * letter (E/W/I/D/V), unmapped. Multiple renderer hooks subscribed to this
 * channel; the guard lives here so future wire-shape changes (e.g. adding
 * `timestamp`) only need to update one place.
 */
export interface DeviceLogPayload {
  level: string
  tag: string
  message: string
}

export function isDeviceLogPayload(v: unknown): v is DeviceLogPayload {
  if (typeof v !== 'object' || v === null) return false
  const o = v as Record<string, unknown>
  return typeof o.level === 'string' && typeof o.tag === 'string' && typeof o.message === 'string'
}

/**
 * Outcome of `deviceIpc.getConfig()` — mirrored from main-process
 * `DeviceConfigResult` so the renderer can branch on the empty-device
 * vs transport-failure cases without leaking transport details.
 * Issue #418.
 */
export type DeviceConfigResult =
  | { ok: true; config: Record<string, unknown> }
  | { ok: false; reason: 'no-config' | 'transport' }

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Default timeout for renderer→main IPC invoke() calls.
 * If a main-side handler hangs (deadlock, lost serial port, missing ack…),
 * the wrapped Promise rejects with `IpcTimeoutError` instead of leaving the
 * UI awaiting forever. Callers that legitimately take longer (large config
 * push, firmware download) override via `invokeWithTimeout`.
 */
export const DEFAULT_IPC_TIMEOUT_MS = 30_000

/**
 * Thrown when a renderer→main IPC invoke() does not resolve within its
 * timeout window. Callers can `instanceof IpcTimeoutError` to distinguish
 * timeouts from handler-thrown errors.
 */
export class IpcTimeoutError extends Error {
  readonly channel: string
  readonly timeoutMs: number

  constructor(channel: string, timeoutMs: number) {
    super(`IPC channel "${channel}" timed out after ${String(timeoutMs)}ms`)
    this.name = 'IpcTimeoutError'
    this.channel = channel
    this.timeoutMs = timeoutMs
  }
}

/**
 * Low-level invoke wrapper with explicit timeout + arg array.
 * Use directly only when the default 30 s timeout is unsuitable.
 */
export function invokeWithTimeout<T>(
  channel: string,
  args: readonly unknown[],
  timeoutMs: number
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new IpcTimeoutError(channel, timeoutMs))
    }, timeoutMs)
    window.ipc.invoke(channel, ...args).then(
      (value) => {
        clearTimeout(timer)
        resolve(value as T)
      },
      (err: unknown) => {
        clearTimeout(timer)
        reject(err instanceof Error ? err : new Error(String(err)))
      }
    )
  })
}

function invoke<T>(channel: string, ...args: unknown[]): Promise<T> {
  return invokeWithTimeout<T>(channel, args, DEFAULT_IPC_TIMEOUT_MS)
}

// ---------------------------------------------------------------------------
// Config file operations
// ---------------------------------------------------------------------------

export const configService = {
  open: () => invoke<OpenResult>(IpcChannels.CONFIG_OPEN),
  openPath: (filePath: string) => invoke<OpenResult>(IpcChannels.CONFIG_OPEN_PATH, filePath),
  save: (config: DashboardConfig) => invoke<SaveResult>(IpcChannels.CONFIG_SAVE, config),
  saveAs: (config: DashboardConfig) => invoke<SaveResult>(IpcChannels.CONFIG_SAVE_AS, config),
  import: () => invoke<OpenResult>(IpcChannels.CONFIG_IMPORT),
  export: (config: DashboardConfig) => invoke<SaveResult>(IpcChannels.CONFIG_EXPORT, config),
}

// ---------------------------------------------------------------------------
// Session persistence
// ---------------------------------------------------------------------------

export const sessionIpc = {
  getLastFilePath: () => invoke<string | null>(IpcChannels.SESSION_GET_LAST_FILE),
  getLastPortPath: () => invoke<string | null>(IpcChannels.SESSION_GET_LAST_PORT),
  getFirstRunCompleted: () => invoke<boolean>(IpcChannels.SESSION_GET_FIRST_RUN_COMPLETED),
  markFirstRunCompleted: (): Promise<void> =>
    invoke<undefined>(IpcChannels.SESSION_MARK_FIRST_RUN_COMPLETED).then(() => undefined),
  resetFirstRun: (): Promise<void> =>
    invoke<undefined>(IpcChannels.SESSION_RESET_FIRST_RUN).then(() => undefined),
}

// ---------------------------------------------------------------------------
// USB device operations
// ---------------------------------------------------------------------------

export interface ScreenSettingsPayload {
  brightness: number
  sleep: number
  rotation?: 0 | 180
}

// Large dashboard configs serialized over USB can outlive the default 30 s
// (slow ack, retries) — give the burn path enough headroom that the timeout
// only fires when the device is truly wedged.
const PUSH_CONFIG_TIMEOUT_MS = 60_000

export const usbService = {
  listPorts: () => invoke<PortInfo[]>(IpcChannels.USB_LIST_PORTS),
  connect: (portPath: string) => invoke<UsbResult>(IpcChannels.USB_CONNECT, portPath),
  disconnect: () => invoke<UsbResult>(IpcChannels.USB_DISCONNECT),
  pushConfig: (config: DashboardConfig) =>
    invokeWithTimeout<UsbResult>(IpcChannels.USB_PUSH_CONFIG, [config], PUSH_CONFIG_TIMEOUT_MS),
  pushScreenSettings: (settings: ScreenSettingsPayload) =>
    invoke<UsbResult>(IpcChannels.USB_SCREEN_SETTINGS, settings),
  getStatus: () => invoke<ConnectionStatus>(IpcChannels.USB_GET_STATUS),
  reboot: () => invoke<UsbResult>(IpcChannels.USB_REBOOT),
  toggleDayNight: () => invoke<UsbResult>(IpcChannels.USB_TOGGLE_DAY_NIGHT),
  setDayNight: (day: boolean) => invoke<UsbResult>(IpcChannels.USB_SET_DAY_NIGHT, day),
  calibrateTouch: () => invoke<UsbResult>(IpcChannels.USB_CALIBRATE_TOUCH),
}

// ---------------------------------------------------------------------------
// Firmware management
// ---------------------------------------------------------------------------

export interface FirmwareDownloadProgress {
  downloadId: string
  received: number
  total: number
}

// Firmware binaries can be several MB — downloading on slow networks easily
// exceeds 30 s. 5 min covers everything short of a stalled CDN.
const FIRMWARE_DOWNLOAD_TIMEOUT_MS = 300_000

// Entering the bootloader cycles DTR/RTS and waits for the chip to settle.
// 30 s is plenty for a healthy port; bumping to 60 s tolerates slow USB hubs.
const ENTER_FLASH_TIMEOUT_MS = 60_000

export const firmwareIpc = {
  queryVersion: () => invoke<FirmwareStatus>(IpcChannels.FIRMWARE_QUERY_VERSION),
  listReleases: (channel: 'stable' | 'beta') =>
    invoke<FirmwareRelease[]>(IpcChannels.FIRMWARE_LIST_RELEASES, channel),
  enterFlash: (portPath: string) =>
    invokeWithTimeout<{ success: boolean }>(
      IpcChannels.FIRMWARE_ENTER_FLASH,
      [portPath],
      ENTER_FLASH_TIMEOUT_MS
    ),
  exitFlash: () => invoke<{ success: boolean }>(IpcChannels.FIRMWARE_EXIT_FLASH),
  /**
   * Re-run the BOOT-mode reset on demand (#482). Used by the renderer when
   * esptool's first sync attempt fails — gives the chip one more clean shot
   * at entering the bootloader before surfacing the manual-BOOT guidance.
   */
  retryResetIntoBootloader: (portPath: string) =>
    invokeWithTimeout<{ success: boolean; error?: string }>(
      IpcChannels.FIRMWARE_RETRY_RESET,
      [portPath],
      ENTER_FLASH_TIMEOUT_MS
    ),
  /** Downloads firmware via the main process to bypass renderer CORS. */
  download: (url: string, downloadId: string) =>
    invokeWithTimeout<ArrayBuffer>(
      IpcChannels.FIRMWARE_DOWNLOAD,
      [url, downloadId],
      FIRMWARE_DOWNLOAD_TIMEOUT_MS
    ),
  /**
   * Downloads a small text sibling (e.g. `firmware.bin.sha256`) via main —
   * same host allowlist as `download()`, length-capped server-side. Used by
   * useFirmwareFlash to verify firmware integrity before flashing (#671).
   */
  downloadText: (url: string) => invoke<string>(IpcChannels.FIRMWARE_DOWNLOAD_TEXT, url),
}

export const deviceIpc = {
  /**
   * Reads the on-device dashboard.json. Returns a discriminated union so the
   * caller can tell "device has no config" from "transport failure" — issue
   * #418.
   */
  getConfig: () => invoke<DeviceConfigResult>(IpcChannels.DEVICE_GET_CONFIG),
}

// ---------------------------------------------------------------------------
// CAN scanner
// ---------------------------------------------------------------------------

export const canScannerIpc = {
  start: () => invoke<{ success: boolean; error?: string }>(IpcChannels.CAN_SCAN_START),
  stop: () => invoke<{ success: boolean; error?: string }>(IpcChannels.CAN_SCAN_STOP),
}

// ---------------------------------------------------------------------------
// Device hardware config
// ---------------------------------------------------------------------------

export const deviceConfigIpc = {
  read: () =>
    invoke<{ success: boolean; config: DeviceConfig | null }>(IpcChannels.DEVICE_CONFIG_READ),
  write: (config: DeviceConfig) =>
    invoke<{ success: boolean; error?: string }>(IpcChannels.DEVICE_CONFIG_WRITE, config),
}

// ---------------------------------------------------------------------------
// App info
// ---------------------------------------------------------------------------

export const appIpc = {
  version: () => invoke<string>(IpcChannels.APP_VERSION),
}

// ---------------------------------------------------------------------------
// GitHub releases info card (issue #571)
// ---------------------------------------------------------------------------

export const releasesIpc = {
  /**
   * Fetches the latest stable + latest pre-release info, honouring a 5-minute
   * cache in main. Pass `force = true` to bypass the cache (used by the
   * "Check now" button). Never throws — returns a discriminated result.
   */
  getLatest: (force = false) => invoke<LatestReleaseResult>(IpcChannels.RELEASES_GET_LATEST, force),
}

// ---------------------------------------------------------------------------
// Signal mapping
// ---------------------------------------------------------------------------

export const signalIpc = {
  export: (config: SignalConfig) =>
    invoke<{ success: boolean; filePath?: string; error?: string }>(
      IpcChannels.SIGNAL_EXPORT,
      config
    ),
}
