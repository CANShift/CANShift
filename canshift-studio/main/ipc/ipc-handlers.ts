// ipc-handlers.ts — Register all IPC handlers for the main process

import { ipcMain, app, BrowserWindow, dialog } from 'electron'
import { writeFile, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { IpcChannels } from './ipc-channels'
import { ConfigFileService } from '../services/config-file.service'
import { UsbService } from '../services/usb.service'
import { checkForUpdates, installUpdate } from '../services/updater.service'
import { firmwareService } from '../services/firmware.service'
import { sdService } from '../services/sd.service'
import { sessionService } from '../services/session.service'
import { buildMenu } from '../menu'
import type { FirmwareRelease } from '../services/firmware.service'
import type { CanFrame } from '../services/usb.service'

/**
 * Singleton USB service instance — exported so that main/index.ts can call
 * usbService.disconnect() during the before-quit lifecycle event.
 */
export const usbService = new UsbService()

export function registerIpcHandlers(getWindow: () => BrowserWindow | null): void {
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
    getWindow()?.webContents.send(IpcChannels.CAN_FRAME_BATCH, canFrameBatch)
    canFrameBatch = []
  }
  setInterval(flushCanBatch, 100)

  // Wire USB device events to the renderer window
  usbService.setEventHandlers({
    onConnectionChanged: (status) => {
      getWindow()?.webContents.send(IpcChannels.USB_CONNECTION_CHANGED, status)
    },
    onError: (message) => {
      getWindow()?.webContents.send(IpcChannels.USB_ERROR, message)
    },
    onTelemetry: (values) => {
      getWindow()?.webContents.send(IpcChannels.USB_DATA_RECEIVED, values)
    },
    onCanFrame: (frame) => {
      canFrameBatch.push(frame)
    },
    onCanHealth: (health) => {
      getWindow()?.webContents.send(IpcChannels.CAN_HEALTH_UPDATE, health)
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

  ipcMain.handle(IpcChannels.CONFIG_OPEN_PATH, async (_event, filePath: string) => {
    const result = await configService.openFilePath(filePath)
    if (result.success && result.filePath) {
      sessionService.addRecentFile(result.filePath)
      rebuildMenu()
    }
    return result
  })

  ipcMain.handle(IpcChannels.CONFIG_SAVE, async (_event, config: unknown) => {
    const result = await configService.saveFile(config)
    if (result.success && result.filePath) {
      sessionService.addRecentFile(result.filePath)
      rebuildMenu()
    }
    return result
  })

  ipcMain.handle(IpcChannels.CONFIG_SAVE_AS, async (_event, config: unknown) => {
    const result = await configService.saveFileAs(config)
    if (result.success && result.filePath) {
      sessionService.addRecentFile(result.filePath)
      rebuildMenu()
    }
    return result
  })

  ipcMain.handle(IpcChannels.SESSION_GET_LAST_FILE, () => {
    return sessionService.getLastFilePath()
  })

  ipcMain.handle(IpcChannels.SESSION_GET_LAST_PORT, () => {
    return sessionService.getLastPortPath()
  })

  // ---------------------------------------------------------------------------
  // USB operations
  // ---------------------------------------------------------------------------

  ipcMain.handle(IpcChannels.USB_LIST_PORTS, async () => {
    return usbService.listPorts()
  })

  ipcMain.handle(IpcChannels.USB_CONNECT, async (_event, portPath: string) => {
    // Refuse any USB connect while a flash is in progress — the renderer's auto-connect
    // would otherwise grab the port between enterFlash() and navigator.serial.requestPort().
    if (firmwareService.getFlashPort()) {
      getWindow()?.webContents.send(IpcChannels.APP_LOG, {
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
    return usbService.pushConfig(config)
  })

  ipcMain.handle(IpcChannels.USB_SCREEN_SETTINGS, async (_event, settings: unknown) => {
    return usbService.pushScreenSettings(
      settings as { brightness: number; sleep: number; rotation?: 0 | 180 }
    )
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

  ipcMain.handle(IpcChannels.FIRMWARE_LIST_RELEASES, async (_event, channel: 'stable' | 'beta') => {
    const releases: FirmwareRelease[] = await firmwareService.listReleases(channel)
    return releases
  })

  ipcMain.handle(IpcChannels.FIRMWARE_ENTER_FLASH, async (_event, portPath: string) => {
    // Disconnect the Node.js serial port so the renderer can use Web Serial API on the same port
    await usbService.disconnect()
    firmwareService.setFlashPort(portPath)
    return { success: true }
  })

  ipcMain.handle(IpcChannels.FIRMWARE_EXIT_FLASH, () => {
    firmwareService.setFlashPort(null)
    return { success: true }
  })

  // Download firmware binaries in main to bypass renderer CORS on GitHub release CDN.
  // Renderer subscribes to FIRMWARE_DOWNLOAD_PROGRESS with the same downloadId for live progress.
  ipcMain.handle(
    IpcChannels.FIRMWARE_DOWNLOAD,
    async (event, url: string, downloadId: string): Promise<ArrayBuffer> => {
      return firmwareService.downloadBinary(url, (received, total) => {
        event.sender.send(IpcChannels.FIRMWARE_DOWNLOAD_PROGRESS, { downloadId, received, total })
      })
    }
  )

  // ---------------------------------------------------------------------------
  // Signal export
  // ---------------------------------------------------------------------------

  ipcMain.handle(IpcChannels.SIGNAL_EXPORT, async (_event, config: unknown) => {
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
  // SD card preparation
  // ---------------------------------------------------------------------------

  ipcMain.handle(IpcChannels.SD_LIST_VOLUMES, () => sdService.listVolumes())

  ipcMain.handle(IpcChannels.SD_PREPARE, (_event, volumePath: string, forceRefresh?: boolean) =>
    sdService.prepareSD(volumePath, forceRefresh ?? false)
  )

  ipcMain.handle(IpcChannels.SD_PUSH_OVER_USB, () =>
    sdService.pushOverUsb(usbService, (progress) => {
      getWindow()?.webContents.send(IpcChannels.SD_PUSH_PROGRESS, progress)
    })
  )

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
    try {
      await writeFile(deviceConfigPath, JSON.stringify(config, null, 2), 'utf-8')
      return { success: true }
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) }
    }
  })
}
