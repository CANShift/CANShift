// ipc.service.ts — Type-safe wrapper around the Electron IPC bridge.
// All renderer → main communication goes through here.

import type { DashboardConfig } from '@tmbk/canshift-core'
import { IpcChannels } from '../../main/ipc/ipc-channels'

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
  save: (config: DashboardConfig) => invoke<SaveResult>(IpcChannels.CONFIG_SAVE, config),
  saveAs: (config: DashboardConfig) => invoke<SaveResult>(IpcChannels.CONFIG_SAVE_AS, config),
}

// ---------------------------------------------------------------------------
// USB device operations
// ---------------------------------------------------------------------------

export const usbService = {
  listPorts: () => invoke<PortInfo[]>(IpcChannels.USB_LIST_PORTS),
  connect: (portPath: string) => invoke<UsbResult>(IpcChannels.USB_CONNECT, portPath),
  disconnect: () => invoke<UsbResult>(IpcChannels.USB_DISCONNECT),
  pushConfig: (config: DashboardConfig) => invoke<UsbResult>(IpcChannels.USB_PUSH_CONFIG, config),
  getStatus: () => invoke<ConnectionStatus>(IpcChannels.USB_GET_STATUS),
  reboot: () => invoke<UsbResult>(IpcChannels.USB_REBOOT),
}
