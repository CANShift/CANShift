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

function invoke<T>(channel: string, ...args: unknown[]): Promise<T> {
  return window.ipc.invoke(channel, ...args) as Promise<T>
}

// ---------------------------------------------------------------------------
// Config file operations
// ---------------------------------------------------------------------------

export const configService = {
  open: () => invoke<OpenResult>(IpcChannels.CONFIG_OPEN),
  openPath: (filePath: string) => invoke<OpenResult>(IpcChannels.CONFIG_OPEN_PATH, filePath),
  save: (config: DashboardConfig) => invoke<SaveResult>(IpcChannels.CONFIG_SAVE, config),
  saveAs: (config: DashboardConfig) => invoke<SaveResult>(IpcChannels.CONFIG_SAVE_AS, config),
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
  rotation: number
}

export const usbService = {
  listPorts: () => invoke<PortInfo[]>(IpcChannels.USB_LIST_PORTS),
  connect: (portPath: string) => invoke<UsbResult>(IpcChannels.USB_CONNECT, portPath),
  disconnect: () => invoke<UsbResult>(IpcChannels.USB_DISCONNECT),
  pushConfig: (config: DashboardConfig) => invoke<UsbResult>(IpcChannels.USB_PUSH_CONFIG, config),
  pushScreenSettings: (settings: ScreenSettingsPayload) =>
    invoke<UsbResult>(IpcChannels.USB_SCREEN_SETTINGS, settings),
  getStatus: () => invoke<ConnectionStatus>(IpcChannels.USB_GET_STATUS),
  reboot: () => invoke<UsbResult>(IpcChannels.USB_REBOOT),
}

// ---------------------------------------------------------------------------
// Firmware management
// ---------------------------------------------------------------------------

export interface FirmwareDownloadProgress {
  downloadId: string
  received: number
  total: number
}

export const firmwareIpc = {
  queryVersion: () => invoke<{ version: string | null }>(IpcChannels.FIRMWARE_QUERY_VERSION),
  listReleases: (channel: 'stable' | 'beta') =>
    invoke<FirmwareRelease[]>(IpcChannels.FIRMWARE_LIST_RELEASES, channel),
  enterFlash: (portPath: string) =>
    invoke<{ success: boolean }>(IpcChannels.FIRMWARE_ENTER_FLASH, portPath),
  exitFlash: () => invoke<{ success: boolean }>(IpcChannels.FIRMWARE_EXIT_FLASH),
  /** Downloads firmware via the main process to bypass renderer CORS. */
  download: (url: string, downloadId: string) =>
    invoke<ArrayBuffer>(IpcChannels.FIRMWARE_DOWNLOAD, url, downloadId),
}

// ---------------------------------------------------------------------------
// CAN scanner
// ---------------------------------------------------------------------------

export const canScannerIpc = {
  start: () => invoke<{ success: boolean; error?: string }>(IpcChannels.CAN_SCAN_START),
  stop: () => invoke<{ success: boolean; error?: string }>(IpcChannels.CAN_SCAN_STOP),
}

// ---------------------------------------------------------------------------
// Asset management
// ---------------------------------------------------------------------------

export interface AssetFile {
  name: string
  spiffsPath: string // e.g. "/images/bg.bmp"
}

export const assetIpc = {
  list: () =>
    invoke<{ success: boolean; files: AssetFile[]; error?: string }>(IpcChannels.ASSET_LIST),
  importImage: () =>
    invoke<{ success: boolean; name?: string; spiffsPath?: string; error?: string }>(
      IpcChannels.ASSET_IMPORT_IMAGE
    ),
  delete: (name: string) =>
    invoke<{ success: boolean; error?: string }>(IpcChannels.ASSET_DELETE, name),
}

// ---------------------------------------------------------------------------
// SD card preparation
// ---------------------------------------------------------------------------

export const sdIpc = {
  listVolumes: () => invoke<SdVolume[]>(IpcChannels.SD_LIST_VOLUMES),
  prepare: (volumePath: string) => invoke<SdPrepareResult>(IpcChannels.SD_PREPARE, volumePath),
  pushOverUsb: () => invoke<SdPrepareResult>(IpcChannels.SD_PUSH_OVER_USB),
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
