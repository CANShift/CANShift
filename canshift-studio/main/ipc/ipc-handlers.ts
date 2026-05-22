// ipc-handlers.ts — Register all IPC handlers for the main process

import { ipcMain, app, BrowserWindow, dialog } from 'electron'
import { writeFile, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { z } from 'zod'
import {
  DashboardConfigSchema,
  DeviceConfigSchema,
  DeviceConfigWireSchema,
  InputBindingsConfigSchema,
  InputBindingsConfigWireSchema,
  ScreenSettingsSchema,
  SignalConfigSchema,
  deviceConfigFromWire,
  deviceConfigToWire,
  inputBindingsFromWire,
  inputBindingsToWire,
} from '@tmbk/canshift-core'
import { IpcChannels } from '../../shared/ipc-channels'
import { friendlyZodIssues, installFriendlyZodErrorMap, summarizeZodError } from './zod-error-map'
import {
  CliLogPayloadSchema,
  type CliLogPayload,
  type CliPanelState,
} from '../../shared/cli-detach.types'
import { ConfigFileService } from '../services/config-file.service'
import { UsbService } from '../services/usb.service'
import { WifiService, DEFAULT_WIFI_PORT } from '../services/wifi.service'
import { checkForUpdates, installUpdate } from '../services/updater.service'
import { firmwareService } from '../services/firmware.service'
import { releasesService } from '../services/releases.service'
import { sessionService } from '../services/session.service'
import { buildMenu } from '../menu'
import { closeCliWindow, getCliWindowState, openCliWindow } from '../windows/cli-window'
import { getBacklog, publish as publishLog } from '../services/cli-log-bus'
import type { FirmwareRelease } from '../../shared/firmware.service.types'
import type { CanFrame } from '../../shared/usb.service.types'
import type { ScreenSettingsPayload } from '../../shared/ipc-payloads'

// Hosts whose URL path identifies the repo — checking that the path is rooted
// at our own owner/repo is enough to constrain these. Used as a first-pass
// shape filter before the trust-set check below.
const FIRMWARE_REPO_BOUND_HOSTS: ReadonlySet<string> = new Set(['github.com', 'api.github.com'])

// Hosts whose URL path is opaque (signed download CDN — paths carry no repo
// identifier). For these, we require the URL to be in the runtime trust set
// populated by `firmwareService.listReleases()`. Without this, any release
// asset from any GitHub repo on the shared CDN would pass the hostname
// allowlist alone (#880).
const FIRMWARE_OPAQUE_CDN_HOSTS: ReadonlySet<string> = new Set([
  'objects.githubusercontent.com',
  'release-assets.githubusercontent.com',
])

const REPO_PATH_PREFIXES: readonly string[] = [
  '/tburkhalterr/CANShift/',
  '/repos/tburkhalterr/CANShift/',
]

// ---------------------------------------------------------------------------
// Renderer payload guards
// ---------------------------------------------------------------------------
//
// IPC handlers receive unknown values from the renderer. The renderer is
// trusted but Electron's process boundary is the right place to enforce the
// shape, so a single corrupt or stale payload can't crash main with a runtime
// type error. These guards are deliberately shallow — deeper schema validation
// (e.g. dashboard config) still runs inside the relevant service or in
// canshift-core's validateDashboard.

// Exported for table-driven tests in ipc-handlers.test.ts. The IPC layer is
// the only place these run in production, but exercising them through the
// ipcMain.handle plumbing would obscure off-by-one regressions (e.g. rotation:
// 90 silently accepted) behind a thick mocking layer.
export function isNonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.length > 0
}

export function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

/**
 * Discriminated result of parsing a CMD_SCREEN_SETTINGS IPC payload — the
 * IPC handler needs the typed error envelope so the renderer can surface
 * issues per field. Audit S-H-1 (#1015) round 2 — replaces the previous
 * `null`-on-failure shape with a Result so the same helper drives both the
 * unit tests and the live handler (no more duplicated `safeParse` block).
 */
export type ParseScreenSettingsResult =
  | { ok: true; data: ScreenSettingsPayload }
  | {
      ok: false
      error: string
      issues: string[]
      friendlyIssues: ReturnType<typeof friendlyZodIssues>
    }

/**
 * Validate the CMD_SCREEN_SETTINGS payload against the shared bounded schema
 * in `@tmbk/canshift-core` (issue #1015, audit finding S-H-1). The previous
 * implementation accepted any finite number for brightness/sleep — a
 * malicious or stale renderer could push brightness=-9999 or sleep=86400000
 * (24 h) and the handler would forward it unchecked. Now bounds live in
 * the schema and out-of-range payloads are rejected at the IPC boundary.
 *
 * Returns a structured Result so the IPC handler can forward typed issues
 * to the renderer without re-running the parse. Exported for table-driven
 * tests in `ipc-payload-guards.test.ts`.
 */
export function parseScreenSettings(v: unknown): ParseScreenSettingsResult {
  const parsed = ScreenSettingsSchema.safeParse(v)
  if (parsed.success) return { ok: true, data: parsed.data }
  return {
    ok: false,
    error: `Screen settings payload invalid — ${summarizeZodError(parsed.error)}`,
    issues: formatZodIssues(parsed.error),
    friendlyIssues: friendlyZodIssues(parsed.error),
  }
}

export function isFirmwareChannel(v: unknown): v is 'stable' | 'beta' {
  return v === 'stable' || v === 'beta'
}

/**
 * Validate the URL of a firmware download request from the renderer.
 *
 * Two-tier policy (issue #880):
 *
 *  1. Repo-bound hosts (github.com / api.github.com). The URL path itself
 *     identifies the repository, so requiring `/tburkhalterr/CANShift/...`
 *     (or `/repos/tburkhalterr/CANShift/...`) is a structural constraint a
 *     hostile renderer cannot bypass.
 *
 *  2. Opaque CDN hosts (objects.githubusercontent.com,
 *     release-assets.githubusercontent.com). These serve assets from EVERY
 *     public GitHub repo from the same hostname, with signed opaque paths
 *     that carry no repo identifier. For these, only URLs that
 *     `firmwareService.listReleases()` previously surfaced (and their
 *     `.sha256` siblings) are accepted.
 *
 * Either way, the URL must be `https:` — cleartext signed firmware would
 * defeat the HMAC trailer the device verifies on flash.
 *
 * Exported for table-driven tests.
 */
export function isFirmwareDownloadUrlAllowed(url: unknown): url is string {
  if (typeof url !== 'string' || url.length === 0) return false
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return false
  }
  if (parsed.protocol !== 'https:') return false

  if (FIRMWARE_REPO_BOUND_HOSTS.has(parsed.hostname)) {
    return REPO_PATH_PREFIXES.some((prefix) => parsed.pathname.startsWith(prefix))
  }

  if (FIRMWARE_OPAQUE_CDN_HOSTS.has(parsed.hostname)) {
    return firmwareService.isFirmwareUrlTrusted(url)
  }

  return false
}

// ---------------------------------------------------------------------------
// Zod schemas for IPC payloads (issue #698)
// ---------------------------------------------------------------------------
//
// USB_PUSH_CONFIG and CONFIG_SAVE both carry a dashboard config; the canonical
// runtime shape lives in canshift-core's `DashboardConfigSchema` (#673) and is
// reused here verbatim — never duplicated — so a stale studio copy can't drift
// from the on-device schema.
//
// DEVICE_CONFIG_WRITE carries the ESP32 hardware config in the camelCase
// domain shape (`DeviceConfigSchema`, #715). The handler maps it to the
// snake_case `DeviceConfigWireSchema` via `deviceConfigToWire` before
// persisting to userData/device.json — firmware reads the wire shape
// verbatim from disk (`config_loader.cpp` reads `doc["can_speed_kbps"]`
// etc.). DEVICE_CONFIG_READ parses the wire shape from disk and returns
// the camelCase domain shape to the renderer.

// Friendly error map runs at module load so every safeParse below benefits
// from improved default messages (#832). Idempotent — calling it twice just
// replaces the previous map.
installFriendlyZodErrorMap()

/**
 * Format Zod issues as `path: message` strings so the renderer can surface a
 * specific reason without re-walking the issue tree. Top-level issues (empty
 * path) collapse to just the message.
 *
 * Kept for the CLI / log surface that wants a flat string list per issue.
 * The richer typed shape lives in `zod-error-map.ts::friendlyZodIssues`.
 */
function formatZodIssues(error: z.ZodError): string[] {
  return error.issues.map((issue) => {
    const path = issue.path.join('.')
    return path.length === 0 ? issue.message : `${path}: ${issue.message}`
  })
}

/**
 * Singleton USB service instance — exported so that main/index.ts can call
 * usbService.disconnect() during the before-quit lifecycle event.
 */
export const usbService = new UsbService()

/**
 * Singleton WiFi (TCP) service instance — parallel to `usbService` (#1071).
 * Same JSON-lines protocol; the renderer picks one transport at connect time.
 * Exported so main/index.ts can disconnect on quit.
 */
export const wifiService = new WifiService()

/**
 * Transport-agnostic command surface — the IPC layer dispatches every
 * USB_* /command channel through this so the renderer never has to branch
 * on transport. Selection priority: WiFi when connected, otherwise USB.
 * Both transports run the same JSON-lines protocol, so the call sites only
 * differ in the underlying socket.
 */
function activeTransport(): UsbService | WifiService {
  if (wifiService.isConnected()) return wifiService
  return usbService
}

// CAN-frame flush timer handle — captured here so disposeIpcHandlers() can
// clear it on app shutdown. Without this the 10 Hz timer keeps Node's event
// loop alive past app.quit().
let canBatchFlushTimer: NodeJS.Timeout | null = null

// ---------------------------------------------------------------------------
// Surfaced-port allowlist (umbrella #1018, SEC-M-3)
// ---------------------------------------------------------------------------
//
// The renderer passes a `portPath` string straight into `new SerialPort({path})`
// from three handlers: USB_CONNECT, FIRMWARE_ENTER_FLASH, FIRMWARE_RETRY_RESET.
// Without a guard, a compromised renderer could pass an arbitrary OS device
// path (e.g. `/dev/disk0`) and open it for read/write. We mitigate by tracking
// the set of paths the main process has actually enumerated via
// `usbService.listPorts()` and refusing any path the renderer was never shown.
//
// The set is rebuilt on every USB_LIST_PORTS — invalidation is implicit: paths
// that disappear from a fresh enumeration are dropped. Exported for tests.
const surfacedPortPaths = new Set<string>()

export function _resetSurfacedPortsForTest(): void {
  surfacedPortPaths.clear()
}

export function _surfacedPortsForTest(): ReadonlySet<string> {
  return surfacedPortPaths
}

/** Stop background timers owned by ipc-handlers. Call from app `before-quit`. */
export function disposeIpcHandlers(): void {
  if (canBatchFlushTimer !== null) {
    clearInterval(canBatchFlushTimer)
    canBatchFlushTimer = null
  }
}

export function registerIpcHandlers(getWindow: () => BrowserWindow | null): void {
  // Guard against sending to a window whose webContents were destroyed (e.g.
  // during a reload triggered by the post-burn reconnect).
  const safeSend = (channel: string, ...args: unknown[]): void => {
    const win = getWindow()
    if (win && !win.isDestroyed() && !win.webContents.isDestroyed()) {
      win.webContents.send(channel, ...args)
    }
  }

  const rebuildMenu = (): void => {
    const win = getWindow()
    if (win) buildMenu(win)
  }
  const configService = new ConfigFileService()

  // Batch CAN frames: accumulate for 100ms then push to renderer in one IPC call.
  // Avoids per-frame IPC overhead on busy CAN buses.
  let canFrameBatch: CanFrame[] = []
  const flushCanBatch = (): void => {
    if (canFrameBatch.length === 0) return
    safeSend(IpcChannels.CAN_FRAME_BATCH, canFrameBatch)
    canFrameBatch = []
  }
  canBatchFlushTimer = setInterval(flushCanBatch, 100)

  // Wire USB device events to the renderer window
  usbService.setEventHandlers({
    onConnectionChanged: (event) => {
      // Renderer is the single source of truth for device-store connection
      // flags (#696) — every transition is published, both true and false.
      safeSend(IpcChannels.USB_CONNECTION_CHANGED, event)
    },
    onError: (message) => {
      safeSend(IpcChannels.USB_ERROR, message)
    },
    onTelemetry: (values) => {
      safeSend(IpcChannels.USB_DATA_RECEIVED, values)
    },
    onCanFrame: (frame) => {
      canFrameBatch.push(frame)
    },
    onCanHealth: (health) => {
      safeSend(IpcChannels.CAN_HEALTH_UPDATE, health)
    },
    onDeviceLog: (entry) => {
      safeSend(IpcChannels.USB_DEVICE_LOG, entry)
    },
  })

  // Wire WiFi device events to the renderer window (issue #1071).
  // Telemetry / CAN / log events reuse the USB-side channels so every
  // renderer surface stays transport-agnostic — only the connection-changed
  // event has its own channel, because the payload shape differs (`host` vs
  // `portPath`).
  wifiService.setEventHandlers({
    onConnectionChanged: (event) => {
      safeSend(IpcChannels.WIFI_CONNECTION_CHANGED, event)
    },
    onError: (message) => {
      safeSend(IpcChannels.USB_ERROR, message)
    },
    onTelemetry: (values) => {
      safeSend(IpcChannels.USB_DATA_RECEIVED, values)
    },
    onCanFrame: (frame) => {
      canFrameBatch.push(frame)
    },
    onCanHealth: (health) => {
      safeSend(IpcChannels.CAN_HEALTH_UPDATE, health)
    },
    onDeviceLog: (entry) => {
      safeSend(IpcChannels.USB_DEVICE_LOG, entry)
    },
  })

  // ---------------------------------------------------------------------------
  // Config file operations
  // ---------------------------------------------------------------------------

  ipcMain.handle(IpcChannels.CONFIG_OPEN, async () => {
    const result = await configService.openFile()
    if (result.success && result.filePath) {
      sessionService.addRecentFile(result.filePath)
      rebuildMenu()
    }
    return result
  })

  ipcMain.handle(IpcChannels.CONFIG_OPEN_PATH, async (_event, filePath: unknown) => {
    if (!isNonEmptyString(filePath)) {
      return { success: false, error: 'filePath must be a non-empty string' }
    }
    const result = await configService.openFilePath(filePath)
    if (result.success && result.filePath) {
      sessionService.addRecentFile(result.filePath)
      rebuildMenu()
    }
    return result
  })

  ipcMain.handle(IpcChannels.CONFIG_SAVE, async (_event, config: unknown) => {
    const parsed = DashboardConfigSchema.safeParse(config)
    if (!parsed.success) {
      return {
        success: false,
        error: `Save payload invalid — ${summarizeZodError(parsed.error)}`,
        issues: formatZodIssues(parsed.error),
        friendlyIssues: friendlyZodIssues(parsed.error),
      }
    }
    const result = await configService.saveFile(parsed.data)
    if (result.success && result.filePath) {
      sessionService.addRecentFile(result.filePath)
      rebuildMenu()
    }
    return result
  })

  ipcMain.handle(IpcChannels.CONFIG_SAVE_AS, async (_event, config: unknown) => {
    const parsed = DashboardConfigSchema.safeParse(config)
    if (!parsed.success) {
      return {
        success: false,
        error: `Save-as payload invalid — ${summarizeZodError(parsed.error)}`,
        issues: formatZodIssues(parsed.error),
        friendlyIssues: friendlyZodIssues(parsed.error),
      }
    }
    const result = await configService.saveFileAs(parsed.data)
    if (result.success && result.filePath) {
      sessionService.addRecentFile(result.filePath)
      rebuildMenu()
    }
    return result
  })

  // Import deliberately does NOT touch sessionService.addRecentFile — the
  // imported file is treated as a foreign source, not a working file.
  ipcMain.handle(IpcChannels.CONFIG_IMPORT, async () => {
    return configService.importFile()
  })

  // Export does NOT update recent files for the same reason — it's a one-shot
  // copy out, not a change of working location.
  ipcMain.handle(IpcChannels.CONFIG_EXPORT, async (_event, config: unknown) => {
    const parsed = DashboardConfigSchema.safeParse(config)
    if (!parsed.success) {
      return {
        success: false,
        error: `Export payload invalid — ${summarizeZodError(parsed.error)}`,
        issues: formatZodIssues(parsed.error),
        friendlyIssues: friendlyZodIssues(parsed.error),
      }
    }
    return configService.exportFile(parsed.data)
  })

  ipcMain.handle(IpcChannels.SESSION_GET_LAST_FILE, () => {
    return sessionService.getLastFilePath()
  })

  ipcMain.handle(IpcChannels.SESSION_GET_LAST_PORT, () => {
    return sessionService.getLastPortPath()
  })

  ipcMain.handle(IpcChannels.SESSION_GET_FIRST_RUN_COMPLETED, () => {
    return sessionService.getFirstRunCompleted()
  })

  ipcMain.handle(IpcChannels.SESSION_MARK_FIRST_RUN_COMPLETED, () => {
    sessionService.markFirstRunCompleted()
  })

  ipcMain.handle(IpcChannels.SESSION_RESET_FIRST_RUN, () => {
    sessionService.resetFirstRun()
  })

  // ---------------------------------------------------------------------------
  // USB operations
  // ---------------------------------------------------------------------------

  ipcMain.handle(IpcChannels.USB_LIST_PORTS, async () => {
    const ports = await usbService.listPorts()
    // Rebuild the allowlist from scratch on every enumeration (#1018, SEC-M-3).
    // A path that was unplugged drops out; a freshly-plugged one becomes
    // openable. The renderer can only request paths it was just shown.
    surfacedPortPaths.clear()
    for (const p of ports) {
      if (typeof p.path === 'string' && p.path.length > 0) {
        surfacedPortPaths.add(p.path)
      }
    }
    // Pre-seed any persisted "last port" so SESSION_GET_LAST_PORT-driven
    // auto-reconnect still works after the OS re-enumerates with the same
    // path. The renderer's auto-connect path doesn't always call
    // USB_LIST_PORTS first (#696).
    const lastPort = sessionService.getLastPortPath()
    if (typeof lastPort === 'string' && lastPort.length > 0) {
      surfacedPortPaths.add(lastPort)
    }
    return ports
  })

  /**
   * Refuse a renderer-supplied port path the main process never enumerated.
   * The three handlers below feed `portPath` straight into `new SerialPort`,
   * which on a Unix-y OS would happily open `/dev/disk0` for read/write.
   */
  function rejectUnsurfacedPort(
    channel: string,
    portPath: string
  ): { status: 'error'; message: 'unknown_port' } {
    safeSend(IpcChannels.APP_LOG, {
      level: 'warn',
      message: `Refused ${channel} — unknown port ${portPath} (not in surfaced allowlist)`,
      ts: Date.now(),
    })
    return { status: 'error', message: 'unknown_port' }
  }

  ipcMain.handle(IpcChannels.USB_CONNECT, async (_event, portPath: unknown) => {
    if (!isNonEmptyString(portPath)) {
      return { success: false, error: 'portPath must be a non-empty string' }
    }
    if (!surfacedPortPaths.has(portPath)) {
      return rejectUnsurfacedPort('USB_CONNECT', portPath)
    }
    // Refuse any USB connect while a flash is in progress — the renderer's auto-connect
    // would otherwise grab the port between enterFlash() and navigator.serial.requestPort().
    if (firmwareService.getFlashPort()) {
      safeSend(IpcChannels.APP_LOG, {
        level: 'warn',
        message: `Refused USB connect to ${portPath} — flash in progress`,
        ts: Date.now(),
      })
      return { success: false, error: 'Flash in progress' }
    }
    const result = await usbService.connect(portPath)
    if (result.success) sessionService.setLastPortPath(portPath)
    return result
  })

  ipcMain.handle(IpcChannels.USB_DISCONNECT, async () => {
    return usbService.disconnect()
  })

  ipcMain.handle(IpcChannels.USB_PUSH_CONFIG, async (_event, config: unknown) => {
    const parsed = DashboardConfigSchema.safeParse(config)
    if (!parsed.success) {
      return {
        success: false,
        error: `Push payload invalid — ${summarizeZodError(parsed.error)}`,
        issues: formatZodIssues(parsed.error),
        friendlyIssues: friendlyZodIssues(parsed.error),
      }
    }
    return activeTransport().pushConfig(parsed.data)
  })

  ipcMain.handle(IpcChannels.USB_SCREEN_SETTINGS, async (_event, settings: unknown) => {
    // Bounded validation lives in canshift-core's ScreenSettingsSchema
    // (#1015 / audit S-H-1). The previous Number.isFinite-only guard
    // accepted brightness=-9999 and sleep=24h; the shared helper rejects
    // both and returns a structured error envelope so the renderer can
    // surface per-field issues without re-running the parse.
    const result = parseScreenSettings(settings)
    if (!result.ok) {
      safeSend(IpcChannels.APP_LOG, {
        level: 'warn',
        message: `Rejected screen settings IPC — ${result.error}`,
        ts: Date.now(),
      })
      return {
        success: false,
        error: result.error,
        issues: result.issues,
        friendlyIssues: result.friendlyIssues,
      }
    }
    return activeTransport().pushScreenSettings(result.data)
  })

  ipcMain.handle(IpcChannels.USB_GET_STATUS, () => {
    return usbService.getStatus()
  })

  ipcMain.handle(IpcChannels.USB_REBOOT, async () => {
    return activeTransport().rebootDevice()
  })

  ipcMain.handle(IpcChannels.USB_TOGGLE_DAY_NIGHT, async () => {
    return activeTransport().toggleDayNight()
  })

  ipcMain.handle(IpcChannels.USB_SET_DAY_NIGHT, async (_event, day: unknown) => {
    if (typeof day !== 'boolean') {
      return { success: false, error: 'set-day-night payload must be a boolean' }
    }
    return activeTransport().setDayNight(day)
  })

  ipcMain.handle(IpcChannels.USB_CALIBRATE_TOUCH, async () => {
    return activeTransport().calibrateTouch()
  })

  // ---------------------------------------------------------------------------
  // CAN scanner
  // ---------------------------------------------------------------------------

  ipcMain.handle(IpcChannels.CAN_SCAN_START, async () => {
    return activeTransport().startCanScan()
  })

  ipcMain.handle(IpcChannels.CAN_SCAN_STOP, async () => {
    return activeTransport().stopCanScan()
  })

  // ---------------------------------------------------------------------------
  // Firmware management
  // ---------------------------------------------------------------------------

  ipcMain.handle(IpcChannels.FIRMWARE_QUERY_VERSION, async () => {
    return activeTransport().queryVersion()
  })

  ipcMain.handle(IpcChannels.DEVICE_GET_CONFIG, async () => {
    return activeTransport().getConfig()
  })

  // ---------------------------------------------------------------------------
  // WiFi device operations (issue #1071)
  // ---------------------------------------------------------------------------

  ipcMain.handle(IpcChannels.WIFI_DISCOVER, async () => {
    return wifiService.discover()
  })

  // Renderer payload: { host: string; port?: number }
  const WifiConnectPayloadSchema = z.object({
    host: z.string().min(1).max(253),
    port: z.number().int().min(1).max(65_535).optional(),
  })

  ipcMain.handle(IpcChannels.WIFI_CONNECT, async (_event, payload: unknown) => {
    const parsed = WifiConnectPayloadSchema.safeParse(payload)
    if (!parsed.success) {
      return {
        success: false,
        error: `WiFi connect payload invalid — ${summarizeZodError(parsed.error)}`,
        issues: formatZodIssues(parsed.error),
        friendlyIssues: friendlyZodIssues(parsed.error),
      }
    }
    // Single transport at a time — if a USB session is live, close it first.
    if (usbService.getStatus().connected) {
      await usbService.disconnect()
    }
    return wifiService.connect(parsed.data.host, parsed.data.port ?? DEFAULT_WIFI_PORT)
  })

  ipcMain.handle(IpcChannels.WIFI_DISCONNECT, async () => {
    return wifiService.disconnect()
  })

  ipcMain.handle(IpcChannels.WIFI_GET_STATUS, () => {
    return wifiService.getStatus()
  })

  ipcMain.handle(IpcChannels.FIRMWARE_LIST_RELEASES, async (_event, channel: unknown) => {
    if (!isFirmwareChannel(channel)) {
      throw new Error('channel must be "stable" or "beta"')
    }
    const releases: FirmwareRelease[] = await firmwareService.listReleases(channel)
    return releases
  })

  ipcMain.handle(IpcChannels.FIRMWARE_ENTER_FLASH, async (_event, portPath: unknown) => {
    if (!isNonEmptyString(portPath)) {
      return { success: false, error: 'portPath must be a non-empty string' }
    }
    if (!surfacedPortPaths.has(portPath)) {
      return rejectUnsurfacedPort('FIRMWARE_ENTER_FLASH', portPath)
    }
    // Disconnect the Node.js serial port so the renderer can use Web Serial API on the same port
    await usbService.disconnect()
    // Drive the BOOT-mode reset from the main process — Web Serial's setSignals
    // is too flaky on macOS CH340 to reliably enter download mode (#196).
    const reset = await firmwareService.resetIntoBootloader(portPath)
    if (!reset.success) {
      safeSend(IpcChannels.APP_LOG, {
        level: 'warn',
        message: `Pre-flash reset failed: ${reset.error ?? 'unknown'} — esptool-js will retry from Web Serial`,
        ts: Date.now(),
      })
    } else if (reset.error) {
      safeSend(IpcChannels.APP_LOG, {
        level: 'warn',
        message: `Pre-flash reset succeeded with caveat: ${reset.error}`,
        ts: Date.now(),
      })
    } else {
      safeSend(IpcChannels.APP_LOG, {
        level: 'info',
        message: `Pre-flash reset OK — chip should be in bootloader on ${portPath}`,
        ts: Date.now(),
      })
    }
    firmwareService.setFlashPort(portPath)
    return { success: true }
  })

  ipcMain.handle(IpcChannels.FIRMWARE_EXIT_FLASH, () => {
    firmwareService.setFlashPort(null)
    return { success: true }
  })

  // Re-run the bootloader reset (#482) — used by the renderer when esptool's
  // first sync attempt fails. Same shape as the reset embedded in
  // FIRMWARE_ENTER_FLASH, but standalone so the renderer can chain it
  // between two `loader.main('no_reset')` calls without re-entering the
  // full enter-flash dance.
  ipcMain.handle(IpcChannels.FIRMWARE_RETRY_RESET, async (_event, portPath: unknown) => {
    if (!isNonEmptyString(portPath)) {
      return { success: false, error: 'portPath must be a non-empty string' }
    }
    if (!surfacedPortPaths.has(portPath)) {
      return rejectUnsurfacedPort('FIRMWARE_RETRY_RESET', portPath)
    }
    const reset = await firmwareService.resetIntoBootloader(portPath)
    if (!reset.success) {
      safeSend(IpcChannels.APP_LOG, {
        level: 'warn',
        message: `Retry reset failed: ${reset.error ?? 'unknown'}`,
        ts: Date.now(),
      })
    } else if (reset.error) {
      safeSend(IpcChannels.APP_LOG, {
        level: 'warn',
        message: `Retry reset succeeded with caveat: ${reset.error}`,
        ts: Date.now(),
      })
    } else {
      safeSend(IpcChannels.APP_LOG, {
        level: 'info',
        message: `Retry reset OK on ${portPath}`,
        ts: Date.now(),
      })
    }
    return reset
  })

  // Download firmware binaries in main to bypass renderer CORS on GitHub release CDN.
  // Renderer subscribes to FIRMWARE_DOWNLOAD_PROGRESS with the same downloadId for live progress.
  ipcMain.handle(
    IpcChannels.FIRMWARE_DOWNLOAD,
    async (event, url: unknown, downloadId: unknown): Promise<ArrayBuffer> => {
      if (!isFirmwareDownloadUrlAllowed(url)) {
        throw new Error('blocked: firmware download URL not on allowlist')
      }
      if (!isNonEmptyString(downloadId)) {
        throw new Error('downloadId must be a non-empty string')
      }
      return firmwareService.downloadBinary(url, (received, total) => {
        event.sender.send(IpcChannels.FIRMWARE_DOWNLOAD_PROGRESS, { downloadId, received, total })
      })
    }
  )

  // Download a small text sibling (e.g. `firmware.bin.sha256`) used by the
  // renderer to verify firmware integrity before flashing (#671). Same host
  // allowlist as the binary path; the underlying service caps the response
  // length so a hostile mirror can't stream an unbounded body.
  ipcMain.handle(
    IpcChannels.FIRMWARE_DOWNLOAD_TEXT,
    async (_event, url: unknown): Promise<string> => {
      if (!isFirmwareDownloadUrlAllowed(url)) {
        throw new Error('blocked: firmware download URL not on allowlist')
      }
      return firmwareService.downloadText(url)
    }
  )

  // ---------------------------------------------------------------------------
  // Signal export
  // ---------------------------------------------------------------------------

  ipcMain.handle(IpcChannels.SIGNAL_EXPORT, async (_event, config: unknown) => {
    const parsed = SignalConfigSchema.safeParse(config)
    if (!parsed.success) {
      return {
        success: false,
        error: `Signal export payload invalid — ${summarizeZodError(parsed.error)}`,
        issues: formatZodIssues(parsed.error),
        friendlyIssues: friendlyZodIssues(parsed.error),
      }
    }
    const { filePath, canceled } = await dialog.showSaveDialog({
      title: 'Export signals.json',
      defaultPath: 'signals.json',
      filters: [{ name: 'JSON', extensions: ['json'] }],
    })
    if (canceled || !filePath) return { success: false }
    try {
      await writeFile(filePath, JSON.stringify(parsed.data, null, 2), 'utf-8')
      return { success: true, filePath }
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) }
    }
  })

  // ---------------------------------------------------------------------------
  // App info
  // ---------------------------------------------------------------------------

  ipcMain.handle(IpcChannels.APP_VERSION, () => app.getVersion())

  // ---------------------------------------------------------------------------
  // Auto-update
  // ---------------------------------------------------------------------------

  ipcMain.handle(IpcChannels.UPDATE_CHECK, () => {
    checkForUpdates()
  })

  ipcMain.handle(IpcChannels.UPDATE_INSTALL, () => {
    installUpdate()
  })

  // ---------------------------------------------------------------------------
  // GitHub releases info card (issue #571)
  // ---------------------------------------------------------------------------

  ipcMain.handle(IpcChannels.RELEASES_GET_LATEST, async (_event, force: unknown) => {
    return releasesService.getLatest(force === true)
  })

  // ---------------------------------------------------------------------------
  // Device hardware config — persisted in userData/device.json
  // ---------------------------------------------------------------------------

  const deviceConfigPath = join(app.getPath('userData'), 'device.json')

  ipcMain.handle(IpcChannels.DEVICE_CONFIG_READ, async () => {
    try {
      const raw = await readFile(deviceConfigPath, 'utf-8')
      // device.json on disk is the snake_case wire shape consumed by firmware.
      // Parse it, then map to the camelCase domain shape before handing it to
      // the renderer (#715). Anything that doesn't match the wire schema is
      // treated as "no config" so the renderer falls back to defaults.
      const parsed = DeviceConfigWireSchema.safeParse(JSON.parse(raw))
      if (!parsed.success) {
        return { success: false, config: null }
      }
      return { success: true, config: deviceConfigFromWire(parsed.data) }
    } catch {
      return { success: false, config: null }
    }
  })

  ipcMain.handle(IpcChannels.DEVICE_CONFIG_WRITE, async (_event, config: unknown) => {
    // Renderer sends the camelCase domain shape. Validate, then map to the
    // snake_case wire shape before persisting to disk (#715) — firmware reads
    // device.json keys verbatim and the wire format must stay unchanged.
    const parsed = DeviceConfigSchema.safeParse(config)
    if (!parsed.success) {
      return {
        success: false,
        error: `Device config invalid — ${summarizeZodError(parsed.error)}`,
        issues: formatZodIssues(parsed.error),
        friendlyIssues: friendlyZodIssues(parsed.error),
      }
    }
    try {
      const wire = deviceConfigToWire(parsed.data)
      await writeFile(deviceConfigPath, JSON.stringify(wire, null, 2), 'utf-8')
      return { success: true }
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) }
    }
  })

  // ---------------------------------------------------------------------------
  // Input bindings (#833) — physical GPIO buttons, persisted in
  // userData/input_bindings.json. Same wire↔domain pattern as device config.
  // ---------------------------------------------------------------------------

  const inputBindingsPath = join(app.getPath('userData'), 'input_bindings.json')

  ipcMain.handle(IpcChannels.INPUT_BINDINGS_READ, async () => {
    try {
      const raw = await readFile(inputBindingsPath, 'utf-8')
      const parsed = InputBindingsConfigWireSchema.safeParse(JSON.parse(raw))
      if (!parsed.success) {
        return { success: false, config: null }
      }
      return { success: true, config: inputBindingsFromWire(parsed.data) }
    } catch {
      // Missing file is a valid "no bindings yet" state — surface as success
      // with an empty config so the UI shows an empty list, not an error.
      return { success: true, config: { inputBindings: [] } }
    }
  })

  ipcMain.handle(IpcChannels.INPUT_BINDINGS_WRITE, async (_event, config: unknown) => {
    const parsed = InputBindingsConfigSchema.safeParse(config)
    if (!parsed.success) {
      return {
        success: false,
        error: `Input bindings invalid — ${summarizeZodError(parsed.error)}`,
        issues: formatZodIssues(parsed.error),
        friendlyIssues: friendlyZodIssues(parsed.error),
      }
    }
    try {
      const wire = inputBindingsToWire(parsed.data)
      await writeFile(inputBindingsPath, JSON.stringify(wire, null, 2), 'utf-8')
      return { success: true }
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) }
    }
  })

  // ---------------------------------------------------------------------------
  // CLI panel detach (issue #433)
  // ---------------------------------------------------------------------------

  // The main window subscribes to the log bus once in createWindow() so
  // detached entries flow back into the in-app surface even after a re-attach
  // round trip. The detached window subscribes itself in cli-window.ts on
  // construction. cli-log-bus prunes destroyed WebContents on the next
  // publish, so a closed main window's stale subscription is harmless and the
  // new window created on macOS dock re-open re-subscribes itself.

  ipcMain.handle(IpcChannels.CLI_DETACH, (): { windowId: number } => {
    const windowId = openCliWindow(getWindow)
    return { windowId }
  })

  ipcMain.handle(IpcChannels.CLI_REATTACH, (): { success: true } => {
    closeCliWindow()
    return { success: true }
  })

  ipcMain.handle(
    IpcChannels.CLI_GET_STATE,
    (): { state: CliPanelState; backlog: readonly CliLogPayload[] } => {
      return { state: getCliWindowState(), backlog: getBacklog() }
    }
  )

  ipcMain.on(IpcChannels.CLI_LOG_PUSH, (event, payload: unknown) => {
    const parsed = CliLogPayloadSchema.safeParse(payload)
    if (!parsed.success) return
    publishLog(parsed.data, event.sender.id)
  })
}
