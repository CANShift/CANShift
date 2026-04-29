// main/index.ts — Electron main process entry point

import { app, BrowserWindow, shell, nativeImage } from 'electron'
import { join } from 'path'
import { registerIpcHandlers } from './ipc/ipc-handlers'
import { buildMenu } from './menu'

let mainWindow: BrowserWindow | null = null

const appIcon = nativeImage.createFromPath(join(__dirname, '../../assets/icon.png'))

function createWindow(): void {
  mainWindow = new BrowserWindow({
    icon: appIcon,
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 640,
    title: 'CANShift Studio',
    backgroundColor: '#111111',
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 14, y: 14 },
    webPreferences: {
      preload: join(__dirname, '../preload/preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()
    if (mainWindow) buildMenu(mainWindow)
  })

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url)
    return { action: 'deny' }
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    void mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    void mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

void app.whenReady().then(() => {
  if (process.platform === 'darwin') {
    app.dock.setIcon(appIcon)
  }
  registerIpcHandlers()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
