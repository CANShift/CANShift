// ipc-allowlist.ts — Per-direction allowlists for the preload IPC bridge.
//
// A compromised renderer must not be able to reach arbitrary internal channels.
// We split `IpcChannels` into three explicit sets matching each preload method:
//
//   • INVOKE_ALLOWED — channels handled by `ipcMain.handle` (request/response).
//   • SEND_ALLOWED   — channels handled by `ipcMain.on` (fire-and-forget).
//   • LISTEN_ALLOWED — channels the main process pushes via `webContents.send`
//                       (renderer subscribes via `on`/`off`).
//
// Adding a new channel to `ipc-channels.ts` requires also classifying it here.
// `assertChannelCoverage` enforces that every entry of `IpcChannels` belongs to
// at least one of the three sets, so a forgotten classification fails fast.

import { IpcChannels, type IpcChannel } from './ipc-channels'

const C = IpcChannels

export const INVOKE_ALLOWED: ReadonlySet<IpcChannel> = new Set<IpcChannel>([
  // Config file operations
  C.CONFIG_OPEN,
  C.CONFIG_OPEN_PATH,
  C.CONFIG_SAVE,
  C.CONFIG_SAVE_AS,
  C.CONFIG_IMPORT,
  C.CONFIG_EXPORT,
  // Session persistence
  C.SESSION_GET_LAST_FILE,
  C.SESSION_GET_LAST_PORT,
  C.SESSION_GET_FIRST_RUN_COMPLETED,
  C.SESSION_MARK_FIRST_RUN_COMPLETED,
  C.SESSION_RESET_FIRST_RUN,
  // USB device operations
  C.USB_LIST_PORTS,
  C.USB_CONNECT,
  C.USB_DISCONNECT,
  C.USB_PUSH_CONFIG,
  C.USB_SCREEN_SETTINGS,
  C.USB_GET_STATUS,
  C.USB_REBOOT,
  C.USB_TOGGLE_DAY_NIGHT,
  C.USB_SET_DAY_NIGHT,
  C.USB_CALIBRATE_TOUCH,
  // CAN scanner
  C.CAN_SCAN_START,
  C.CAN_SCAN_STOP,
  // Firmware management
  C.FIRMWARE_QUERY_VERSION,
  C.FIRMWARE_LIST_RELEASES,
  C.FIRMWARE_ENTER_FLASH,
  C.FIRMWARE_EXIT_FLASH,
  C.FIRMWARE_RETRY_RESET,
  C.FIRMWARE_DOWNLOAD,
  // On-device config
  C.DEVICE_GET_CONFIG,
  // Signal mapping
  C.SIGNAL_EXPORT,
  // App info / auto-update controls
  C.APP_VERSION,
  C.UPDATE_CHECK,
  C.UPDATE_INSTALL,
  // Device hardware config
  C.DEVICE_CONFIG_READ,
  C.DEVICE_CONFIG_WRITE,
  // GitHub releases info card (issue #571)
  C.RELEASES_GET_LATEST,
  // CLI panel detach (issue #433) — renderer → main control surface
  C.CLI_DETACH,
  C.CLI_REATTACH,
  C.CLI_GET_STATE,
])

export const SEND_ALLOWED: ReadonlySet<IpcChannel> = new Set<IpcChannel>([
  // Renderer → main: latest dirty flag
  C.WINDOW_SET_DIRTY,
  // Renderer → main: forward a freshly-pushed log entry to other CLI surfaces
  C.CLI_LOG_PUSH,
])

export const LISTEN_ALLOWED: ReadonlySet<IpcChannel> = new Set<IpcChannel>([
  // Menu-driven actions (main → renderer)
  C.CONFIG_OPEN,
  C.CONFIG_OPEN_PATH,
  C.CONFIG_SAVE,
  C.CONFIG_SAVE_AS,
  C.CONFIG_IMPORT,
  C.CONFIG_EXPORT,
  C.HISTORY_UNDO,
  C.HISTORY_REDO,
  C.EDIT_DUPLICATE,
  // USB / CAN telemetry events
  C.USB_CONNECTION_CHANGED,
  C.USB_DATA_RECEIVED,
  C.USB_ERROR,
  C.USB_DEVICE_LOG,
  C.CAN_FRAME_BATCH,
  C.CAN_HEALTH_UPDATE,
  // Firmware download progress
  C.FIRMWARE_DOWNLOAD_PROGRESS,
  // Main-process log forwarding
  C.APP_LOG,
  // Auto-update
  C.UPDATE_AVAILABLE,
  C.UPDATE_DOWNLOADED,
  C.UPDATE_ERROR,
  // CLI panel detach (issue #433) — main → renderer broadcasts
  C.CLI_STATE_CHANGED,
  C.CLI_LOG_BROADCAST,
])

/** Throws when `channel` is not in the renderer→main invoke allowlist. */
export function assertInvokeAllowed(channel: string): void {
  if (!INVOKE_ALLOWED.has(channel as IpcChannel)) {
    throw new Error(`blocked IPC invoke channel: ${channel}`)
  }
}

/** Throws when `channel` is not in the renderer→main send allowlist. */
export function assertSendAllowed(channel: string): void {
  if (!SEND_ALLOWED.has(channel as IpcChannel)) {
    throw new Error(`blocked IPC send channel: ${channel}`)
  }
}

/** Throws when `channel` is not in the main→renderer listen allowlist. */
export function assertListenAllowed(channel: string): void {
  if (!LISTEN_ALLOWED.has(channel as IpcChannel)) {
    throw new Error(`blocked IPC listen channel: ${channel}`)
  }
}

/**
 * Returns the channels declared in `IpcChannels` that are not covered by any
 * allowlist. Used by tests to fail fast when a new channel is added without
 * being classified.
 */
export function findUnclassifiedChannels(): IpcChannel[] {
  const all = Object.values(IpcChannels) as IpcChannel[]
  return all.filter((c) => !INVOKE_ALLOWED.has(c) && !SEND_ALLOWED.has(c) && !LISTEN_ALLOWED.has(c))
}
