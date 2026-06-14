import type { DashboardConfig } from '@tmbk/canshift-core'

export interface PortInfo {
  path: string
  manufacturer?: string
  serialNumber?: string
  productId?: string
  vendorId?: string
  description?: string
}

export interface UsbResult {
  success: boolean
  error?: string
}

export interface ConnectionStatus {
  connected: boolean
  portPath: string | null
  firmwareVersion?: string | null
}

export interface FirmwareIdentity {
  version: string
  protocol: number
  isDay: boolean
}

export type FirmwareIdentityResult =
  | { kind: 'ok'; identity: FirmwareIdentity }
  | { kind: 'error'; error: string }

export type PingResult = { kind: 'ok'; uptimeMs: number | null } | { kind: 'error'; error: string }

export type RawAck =
  | { kind: 'ok'; data: Record<string, unknown> }
  | { kind: 'error'; error: string; data: Record<string, unknown> | null }

export type DeviceConfigResult =
  | { kind: 'ok'; config: DashboardConfig }
  | { kind: 'none' }
  | { kind: 'error'; error: string }

export type Unsubscribe = () => void
export type Handler<T> = (event: T) => void

const OK: UsbResult = { success: true }

export const toUsbResult = (result: { ok: boolean; error?: string }): UsbResult =>
  result.ok ? OK : { success: false, error: result.error ?? 'unknown_error' }

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null
