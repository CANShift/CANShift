// ipc-payloads.ts — Studio-local IPC payload shapes that cross the
// main ↔ renderer process boundary. Anything carried over an IPC
// channel whose canonical shape isn't already defined in
// `@tmbk/canshift-core` belongs here, so main and renderer agree on
// the wire format from a single source (#710, #790).

/**
 * Payload of `IpcChannels.FIRMWARE_QUERY_VERSION` — main's
 * `usb.service.queryVersion()` returns this verbatim and the renderer
 * mirrors it through `firmwareIpc.queryVersion()`.
 */
export interface FirmwareStatus {
  version: string | null
  isDay: boolean | null
}

/**
 * Shape of the `USB_DEVICE_LOG` IPC payload — `level` is the raw firmware
 * letter (E/W/I/D/V), unmapped. Multiple renderer hooks subscribe to this
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
 * Outcome of a CMD_GET_CONFIG round-trip — discriminates the empty-device
 * branch (firmware reports `config_not_found`) from any transport-level
 * failure (port closed, ack timeout, malformed response). Issue #418.
 */
export type DeviceConfigResult =
  | { ok: true; config: Record<string, unknown> }
  | { ok: false; reason: 'no-config' | 'transport' }

/**
 * Payload of `IpcChannels.USB_SCREEN_SETTINGS` — brightness/sleep/rotation
 * bounds and the strict shape live in `@tmbk/canshift-core`'s
 * `ScreenSettingsSchema` (issue #1015, audit finding S-H-1). The type is
 * re-exported here so renderer-side consumers keep a stable local import.
 */
export type { ScreenSettings as ScreenSettingsPayload } from '@tmbk/canshift-core'

/**
 * Payload of `IpcChannels.FIRMWARE_DOWNLOAD_PROGRESS` — emitted by main
 * during a `FIRMWARE_DOWNLOAD` invocation so the renderer can render a
 * live progress bar matched to its own `downloadId`.
 */
export interface FirmwareDownloadProgress {
  downloadId: string
  received: number
  total: number
}
