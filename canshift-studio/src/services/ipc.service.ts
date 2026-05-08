// ipc.service.ts — Type-safe wrapper around the Electron IPC bridge.
// All renderer → main communication goes through here.

import type { DashboardConfig, SignalConfig, DeviceConfig } from '@tmbk/canshift-core'
import { IpcChannels } from '../../main/ipc/ipc-channels'
import type { FirmwareRelease } from '../../main/services/firmware.service'
import type { CanFrame, CanHealth } from '../../main/services/usb.service'
import type { SdVolume, SdPrepareResult, SdPushProgress } from '../../main/services/sd.service'

export type { FirmwareRelease, CanFrame, CanHealth, SdVolume, SdPrepareResult, SdPushProgress }

// ---------------------------------------------------------------------------
// Response shapes (must mirror main/services/* return types)
// ---------------------------------------------------------------------------

export interface OpenResult {
  success: boolean
  filePath?: string
  content?: unknown
  error?: string
}

export interface SaveResult {
  success: boolean
  filePath?: string
  error?: string
}

export interface PortInfo {
  path: string
  manufacturer?: string
  serialNumber?: string
  vendorId?: string
  productId?: string
}

export interface UsbResult {
  success: boolean
  error?: string
}

export interface ConnectionStatus {
  connected: boolean
  portPath?: string
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Default timeout for renderer→main IPC invoke() calls.
 * If a main-side handler hangs (deadlock, lost serial port, missing ack…),
 * the wrapped Promise rejects with `IpcTimeoutError` instead of leaving the
 * UI awaiting forever. Callers that legitimately take longer (chunked SD
 * push, large config push, firmware download) override via `invokeWithTimeout`.
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
  queryVersion: () =>
    invoke<{ version: string | null; isDay: boolean | null }>(IpcChannels.FIRMWARE_QUERY_VERSION),
  listReleases: (channel: 'stable' | 'beta') =>
    invoke<FirmwareRelease[]>(IpcChannels.FIRMWARE_LIST_RELEASES, channel),
  enterFlash: (portPath: string) =>
    invokeWithTimeout<{ success: boolean }>(
      IpcChannels.FIRMWARE_ENTER_FLASH,
      [portPath],
      ENTER_FLASH_TIMEOUT_MS
    ),
  exitFlash: () => invoke<{ success: boolean }>(IpcChannels.FIRMWARE_EXIT_FLASH),
  /** Downloads firmware via the main process to bypass renderer CORS. */
  download: (url: string, downloadId: string) =>
    invokeWithTimeout<ArrayBuffer>(
      IpcChannels.FIRMWARE_DOWNLOAD,
      [url, downloadId],
      FIRMWARE_DOWNLOAD_TIMEOUT_MS
    ),
}

export const deviceIpc = {
  /** Reads the on-device dashboard.json (returns null when unavailable). */
  getConfig: () => invoke<Record<string, unknown> | null>(IpcChannels.DEVICE_GET_CONFIG),
}

// ---------------------------------------------------------------------------
// CAN scanner
// ---------------------------------------------------------------------------

export const canScannerIpc = {
  start: () => invoke<{ success: boolean; error?: string }>(IpcChannels.CAN_SCAN_START),
  stop: () => invoke<{ success: boolean; error?: string }>(IpcChannels.CAN_SCAN_STOP),
}

// ---------------------------------------------------------------------------
// SD card preparation
// ---------------------------------------------------------------------------

// SD prep + push stream many chunked acks; assets total a few MB at ~32 KB
// chunks. The whole flow can run several minutes on slow SD cards.
const SD_PREPARE_TIMEOUT_MS = 300_000
const SD_PUSH_TIMEOUT_MS = 600_000

export const sdIpc = {
  listVolumes: () => invoke<SdVolume[]>(IpcChannels.SD_LIST_VOLUMES),
  prepare: (volumePath: string, forceRefresh = false) =>
    invokeWithTimeout<SdPrepareResult>(
      IpcChannels.SD_PREPARE,
      [volumePath, forceRefresh],
      SD_PREPARE_TIMEOUT_MS
    ),
  pushOverUsb: () =>
    invokeWithTimeout<SdPrepareResult>(IpcChannels.SD_PUSH_OVER_USB, [], SD_PUSH_TIMEOUT_MS),
  onPushProgress: (handler: (progress: SdPushProgress) => void) => {
    const wrapped = (...args: unknown[]): void => {
      handler(args[0] as SdPushProgress)
    }
    window.ipc.on(IpcChannels.SD_PUSH_PROGRESS, wrapped)
    return () => {
      window.ipc.off(IpcChannels.SD_PUSH_PROGRESS, wrapped)
    }
  },
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
// Signal mapping
// ---------------------------------------------------------------------------

export const signalIpc = {
  export: (config: SignalConfig) =>
    invoke<{ success: boolean; filePath?: string; error?: string }>(
      IpcChannels.SIGNAL_EXPORT,
      config
    ),
}
