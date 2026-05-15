// ipc-handlers.ts — Register all IPC handlers for the main process

import { ipcMain, app, BrowserWindow, dialog } from 'electron'
import { writeFile, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { IpcChannels } from './ipc-channels'
import type { CliLogPayload, CliPanelState } from './cli-detach.types'
import { ConfigFileService } from '../services/config-file.service'
import { UsbService } from '../services/usb.service'
import { checkForUpdates, installUpdate } from '../services/updater.service'
import { firmwareService } from '../services/firmware.service'
import { releasesService } from '../services/releases.service'
import { sessionService } from '../services/session.service'
import { buildMenu } from '../menu'
import { closeCliWindow, getCliWindowState, openCliWindow } from '../windows/cli-window'
import {
  getBacklog,
  publish as publishLog,
  subscribe as subscribeLog,
  unsubscribe as unsubscribeLog,
} from '../services/cli-log-bus'
import type { FirmwareRelease } from '../services/firmware.service.types'
import type { CanFrame } from '../services/usb.service.types'

// Allowed hosts for FIRMWARE_DOWNLOAD — defence in depth so a compromised
// renderer cannot turn the main process into an open HTTP fetcher. The CSP
// already restricts renderer outbound, but the IPC bridge skips that path.
const FIRMWARE_DOWNLOAD_ALLOWED_HOSTS: ReadonlySet<string> = new Set([
  'github.com',
  'api.github.com',
  'objects.githubusercontent.com',
  'release-assets.githubusercontent.com',
])

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

export interface ScreenSettingsPayload {
  brightness: number
  sleep: number
  rotation?: 0 | 180
}

export function parseScreenSettings(v: unknown): ScreenSettingsPayload | null {
  if (!isPlainObject(v)) return null
  const brightness = v.brightness
  const sleep = v.sleep
  const rotation = v.rotation
  if (typeof brightness !== 'number' || !Number.isFinite(brightness)) return null
  if (typeof sleep !== 'number' || !Number.isFinite(sleep)) return null
  if (rotation !== undefined && rotation !== 0 && rotation !== 180) return null
  return rotation === undefined ? { brightness, sleep } : { brightness, sleep, rotation }
}

export function isFirmwareChannel(v: unknown): v is 'stable' | 'beta' {
  return v === 'stable' || v === 'beta'
}

/**
 * Validate the URL of a firmware download request from the renderer. Only
 * `https:` URLs whose hostname is in the GitHub-release allowlist pass —
 * this guards against a compromised renderer turning main into an open
 * HTTP fetcher and against cleartext downloads of signed binaries.
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
  return FIRMWARE_DOWNLOAD_ALLOWED_HOSTS.has(parsed.hostname)
}

const CLI_LOG_LEVELS: ReadonlySet<string> = new Set(['info', 'warn', 'error', 'success', 'debug'])

/** Validates an inbound `CLI_LOG_PUSH` payload from the renderer. */
export function parseCliLogPayload(v: unknown): CliLogPayload | null {
  if (!isPlainObject(v)) return null
  const id = v.id
  const level = v.level
  const message = v.message
  const timestampMs = v.timestampMs
  const scope = v.scope
  if (typeof id !== 'number' || !Number.isFinite(id)) return null
  if (typeof level !== 'string' || !CLI_LOG_LEVELS.has(level)) return null
  if (typeof message !== 'string') return null
  if (typeof timestampMs !== 'number' || !Number.isFinite(timestampMs)) return null
  if (scope !== undefined && typeof scope !== 'string') return null
  const base: CliLogPayload = {
    id,
    level: level as CliLogPayload['level'],
    message,
    timestampMs,
  }
  return scope === undefined ? base : { ...base, scope }
}

/**
 * Singleton USB service instance — exported so that main/index.ts can call
 * usbService.disconnect() during the before-quit lifecycle event.
 */
export const usbService = new UsbService()

// CAN-frame flush timer handle — captured here so disposeIpcHandlers() can
// clear it on app shutdown. Without this the 10 Hz timer keeps Node's event
// loop alive past app.quit().
let canBatchFlushTimer: NodeJS.Timeout | null = null

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
    if (!isPlainObject(config)) {
      return { success: false, error: 'Save payload must be a config object' }
    }
    const result = await configService.saveFile(config)
    if (result.success && result.filePath) {
      sessionService.addRecentFile(result.filePath)
      rebuildMenu()
    }
    return result
  })

  ipcMain.handle(IpcChannels.CONFIG_SAVE_AS, async (_event, config: unknown) => {
    if (!isPlainObject(config)) {
      return { success: false, error: 'Save payload must be a config object' }
    }
    const result = await configService.saveFileAs(config)
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
    if (!isPlainObject(config)) {
      return { success: false, error: 'Export payload must be a config object' }
    }
    return configService.exportFile(config)
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
    return usbService.listPorts()
  })

  ipcMain.handle(IpcChannels.USB_CONNECT, async (_event, portPath: unknown) => {
    if (!isNonEmptyString(portPath)) {
      return { success: false, error: 'portPath must be a non-empty string' }
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
    if (!isPlainObject(config)) {
      return { success: false, error: 'Push payload must be a config object' }
    }
    return usbService.pushConfig(config)
  })

  ipcMain.handle(IpcChannels.USB_SCREEN_SETTINGS, async (_event, settings: unknown) => {
    const parsed = parseScreenSettings(settings)
    if (!parsed) {
      return { success: false, error: 'Screen settings payload is invalid' }
    }
    return usbService.pushScreenSettings(parsed)
  })

  ipcMain.handle(IpcChannels.USB_GET_STATUS, () => {
    return usbService.getStatus()
  })

  ipcMain.handle(IpcChannels.USB_REBOOT, async () => {
    return usbService.rebootDevice()
  })

  ipcMain.handle(IpcChannels.USB_TOGGLE_DAY_NIGHT, async () => {
    return usbService.toggleDayNight()
  })

  ipcMain.handle(IpcChannels.USB_SET_DAY_NIGHT, async (_event, day: unknown) => {
    if (typeof day !== 'boolean') {
      return { success: false, error: 'set-day-night payload must be a boolean' }
    }
    return usbService.setDayNight(day)
  })

  ipcMain.handle(IpcChannels.USB_CALIBRATE_TOUCH, async () => {
    return usbService.calibrateTouch()
  })

  // ---------------------------------------------------------------------------
  // CAN scanner
  // ---------------------------------------------------------------------------

  ipcMain.handle(IpcChannels.CAN_SCAN_START, async () => {
    return usbService.startCanScan()
  })

  ipcMain.handle(IpcChannels.CAN_SCAN_STOP, async () => {
    return usbService.stopCanScan()
  })

  // ---------------------------------------------------------------------------
  // Firmware management
  // ---------------------------------------------------------------------------

  ipcMain.handle(IpcChannels.FIRMWARE_QUERY_VERSION, async () => {
    return usbService.queryVersion()
  })

  ipcMain.handle(IpcChannels.DEVICE_GET_CONFIG, async () => {
    return usbService.getConfig()
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
    if (!isPlainObject(config)) {
      return { success: false, error: 'Signal export payload must be an object' }
    }
    const { filePath, canceled } = await dialog.showSaveDialog({
      title: 'Export signals.json',
      defaultPath: 'signals.json',
      filters: [{ name: 'JSON', extensions: ['json'] }],
    })
    if (canceled || !filePath) return { success: false }
    try {
      await writeFile(filePath, JSON.stringify(config, null, 2), 'utf-8')
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
      return { success: true, config: JSON.parse(raw) as unknown }
    } catch {
      return { success: false, config: null }
    }
  })

  ipcMain.handle(IpcChannels.DEVICE_CONFIG_WRITE, async (_event, config: unknown) => {
    if (!isPlainObject(config)) {
      return { success: false, error: 'Device config payload must be an object' }
    }
    try {
      await writeFile(deviceConfigPath, JSON.stringify(config, null, 2), 'utf-8')
      return { success: true }
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) }
    }
  })

  // ---------------------------------------------------------------------------
  // CLI panel detach (issue #433)
  // ---------------------------------------------------------------------------

  // The main window is always a log-bus subscriber so detached entries flow
  // back into the in-app surface even after a re-attach round trip. The
  // detached window subscribes itself in cli-window.ts on construction.
  let mainWindowSubscribed: BrowserWindow | null = null
  const ensureMainWindowSubscribed = (): void => {
    const main = getWindow()
    if (main === null) return
    if (mainWindowSubscribed === main) return
    if (mainWindowSubscribed !== null && !mainWindowSubscribed.isDestroyed()) {
      unsubscribeLog(mainWindowSubscribed.webContents)
    }
    subscribeLog(main.webContents)
    mainWindowSubscribed = main
  }

  ipcMain.handle(IpcChannels.CLI_DETACH, (): { windowId: number } => {
    ensureMainWindowSubscribed()
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
      ensureMainWindowSubscribed()
      return { state: getCliWindowState(), backlog: getBacklog() }
    }
  )

  ipcMain.on(IpcChannels.CLI_LOG_PUSH, (event, payload: unknown) => {
    const parsed = parseCliLogPayload(payload)
    if (parsed === null) return
    publishLog(parsed, event.sender.id)
  })
}
