// ipc-handlers.ts — Register all IPC handlers for the main process

import { ipcMain, app } from 'electron'
import { IpcChannels } from './ipc-channels'
import { ConfigFileService } from '../services/config-file.service'
import { UsbService } from '../services/usb.service'

export function registerIpcHandlers(): void {
  const configService = new ConfigFileService()
  const usbService    = new UsbService()

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

  ipcMain.handle(IpcChannels.USB_GET_STATUS, () => {
    return usbService.getStatus()
  })

  ipcMain.handle(IpcChannels.USB_REBOOT, async () => {
    return usbService.rebootDevice()
  })

  // ---------------------------------------------------------------------------
  // App info
  // ---------------------------------------------------------------------------

  ipcMain.handle(IpcChannels.APP_VERSION, () => app.getVersion())
}
