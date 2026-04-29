// main/index.ts — Electron main process entry point

import { app, BrowserWindow, shell, nativeImage } from 'electron'
import { join } from 'path'
import { registerIpcHandlers } from './ipc/ipc-handlers'
import { buildMenu } from './menu'

let mainWindow: BrowserWindow | null = null

function loadIcon(): Electron.NativeImage | undefined {
  try {
    const img = nativeImage.createFromPath(join(__dirname, '../../assets/icon.png'))
    return img.isEmpty() ? undefined : img
  } catch {
    return undefined
  }
}

function createWindow(): void {
  const icon = loadIcon()

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 640,
    show: false,
    title: 'CANShift Studio',
    backgroundColor: '#111111',
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 14, y: 14 },
    ...(icon ? { icon } : {}),
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

// Short name used for dock/taskbar tooltip and About dialog
app.setName('CS Studio')

app
  .whenReady()
  .then(() => {
    if (process.platform === 'darwin') {
      const icon = loadIcon()
      if (icon) app.dock.setIcon(icon)
    }

    registerIpcHandlers()
    createWindow()

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
  })
  .catch((err: unknown) => {
    console.error('App failed to start:', err)
    app.quit()
  })

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
