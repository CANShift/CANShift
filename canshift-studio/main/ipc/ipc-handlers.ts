// ipc-handlers.ts — Register all IPC handlers for the main process

import { ipcMain, app, BrowserWindow } from 'electron'
import { IpcChannels } from './ipc-channels'
import { ConfigFileService } from '../services/config-file.service'
import { UsbService } from '../services/usb.service'
import { checkForUpdates, installUpdate } from '../services/updater.service'
import { firmwareService } from '../services/firmware.service'
import type { FirmwareRelease } from '../services/firmware.service'

export function registerIpcHandlers(getWindow: () => BrowserWindow | null): void {
  const configService = new ConfigFileService()
  const usbService = new UsbService()

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
  })

  // ---------------------------------------------------------------------------
  // Config file operations
  // ---------------------------------------------------------------------------

  ipcMain.handle(IpcChannels.CONFIG_OPEN, async () => {
    return configService.openFile()
  })

  ipcMain.handle(IpcChannels.CONFIG_SAVE, async (_event, config: unknown) => {
    return configService.saveFile(config)
  })

  ipcMain.handle(IpcChannels.CONFIG_SAVE_AS, async (_event, config: unknown) => {
    return configService.saveFileAs(config)
  })

  // ---------------------------------------------------------------------------
  // USB operations
  // ---------------------------------------------------------------------------

  ipcMain.handle(IpcChannels.USB_LIST_PORTS, async () => {
    return usbService.listPorts()
  })

  ipcMain.handle(IpcChannels.USB_CONNECT, async (_event, portPath: string) => {
    return usbService.connect(portPath)
  })

  ipcMain.handle(IpcChannels.USB_DISCONNECT, async () => {
    return usbService.disconnect()
  })

  ipcMain.handle(IpcChannels.USB_PUSH_CONFIG, async (_event, config: unknown) => {
    return usbService.pushConfig(config)
  })

  ipcMain.handle(IpcChannels.USB_SCREEN_SETTINGS, async (_event, settings: unknown) => {
    return usbService.pushScreenSettings(
      settings as { brightness: number; contrast: number; sleep: number; rotation: number }
    )
  })

  ipcMain.handle(IpcChannels.USB_GET_STATUS, () => {
    return usbService.getStatus()
  })

  ipcMain.handle(IpcChannels.USB_REBOOT, async () => {
    return usbService.rebootDevice()
  })

  // ---------------------------------------------------------------------------
  // Firmware management
  // ---------------------------------------------------------------------------

  ipcMain.handle(IpcChannels.FIRMWARE_QUERY_VERSION, async () => {
    return usbService.queryVersion()
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
}
