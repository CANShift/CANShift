// ipc.ts — Canonical return-shape contracts for renderer ↔ main IPC.
//
// These shapes cross the Electron IPC boundary (renderer ↔ main) so they
// MUST be defined in a single place — drift between the two processes is
// silently lossy (e.g. main sets `data` on a UsbResult, the renderer never
// sees it because its local copy of the type was missing the field).

/** A serial port discovered on the host machine. */
export interface PortInfo {
  path: string
  manufacturer?: string
  serialNumber?: string
  vendorId?: string
  productId?: string
}

/** State of the USB serial connection between studio and the device. */
export interface ConnectionStatus {
  connected: boolean
  portPath?: string
}

/**
 * Result of a USB command sent to the device.
 *
 * `data` carries the full parsed JSON response when the device returns extra
 * fields (e.g. CMD_GET_STATUS → version, is_day). Generic so individual
 * channels can narrow the data shape on the renderer side without losing
 * type-safety.
 */
export interface UsbResult<T extends Record<string, unknown> = Record<string, unknown>> {
  success: boolean
  error?: string
  /** Full parsed JSON response from the device for commands that return extra fields. */
  data?: T
}

/** Result of opening a config file from disk via the main process. */
export interface OpenResult {
  success: boolean
  filePath?: string
  content?: unknown
  error?: string
}

/** Result of saving a config file to disk via the main process. */
export interface SaveResult {
  success: boolean
  filePath?: string
  error?: string
}
