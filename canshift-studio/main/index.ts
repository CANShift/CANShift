// main/index.ts — Electron main process entry point

import { app, BrowserWindow, shell, nativeImage } from 'electron'
import { join, basename } from 'path'
import { readFileSync } from 'fs'
import { registerIpcHandlers } from './ipc/ipc-handlers'
import { buildMenu } from './menu'
import { initUpdater } from './services/updater.service'
import { firmwareService } from './services/firmware.service'

let mainWindow: BrowserWindow | null = null
let splashWindow: BrowserWindow | null = null

function loadIcon(): Electron.NativeImage | undefined {
  try {
    const img = nativeImage.createFromPath(join(__dirname, '../../assets/icon.png'))
    return img.isEmpty() ? undefined : img
  } catch {
    return undefined
  }
}

function createSplash(): void {
  splashWindow = new BrowserWindow({
    width: 480,
    height: 320,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: false,
    skipTaskbar: true,
    center: true,
    webPreferences: { contextIsolation: true, nodeIntegration: false },
  })

  // Read logo as base64 to avoid file:// CSP issues inside a data: page
  let logoSrc = ''
  try {
    const logoPath = join(__dirname, '../../assets/CANShift_studio_logo.png')
    const logoB64 = readFileSync(logoPath).toString('base64')
    logoSrc = `data:image/png;base64,${logoB64}`
  } catch {
    // Logo not found — splash still shows without it
  }

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    width: 480px; height: 320px;
    background: #0D0D0D;
    border-radius: 12px;
    border: 1px solid #2A2A2A;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 20px;
    overflow: hidden;
    -webkit-app-region: drag;
  }
  img { max-width: 320px; max-height: 160px; object-fit: contain; }
  .label {
    font-family: -apple-system, BlinkMacSystemFont, sans-serif;
    font-size: 11px;
    color: #333333;
    letter-spacing: 0.12em;
    text-transform: uppercase;
  }
</style>
</head>
<body>
  ${logoSrc ? `<img src="${logoSrc}" alt="CS Studio" />` : ''}
  <span class="label">Loading…</span>
</body>
</html>`

  void splashWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`)
}

function createWindow(): void {
  const icon = loadIcon()

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 640,
    show: false,
    title: 'CS Studio',
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

  // Web Serial API — grant blanket serial permission to the app and auto-select the flash port.
  // The renderer uses navigator.serial (Web Serial) only during firmware flashing.
  mainWindow.webContents.session.setPermissionCheckHandler((_wc, permission) => {
    return permission === 'serial'
  })
  mainWindow.webContents.session.setDevicePermissionHandler((details) => {
    return details.deviceType === 'serial'
  })
  mainWindow.webContents.session.on('select-serial-port', (event, portList, _wc, callback) => {
    event.preventDefault()
    const target = firmwareService.getFlashPort()
    if (!target) {
      callback('') // no flash in progress — deny
      return
    }
    // Match on exact portId or basename (macOS: /dev/tty.usbserial-XXX)
    const found = portList.find(
      (p) => p.portId === target || basename(p.portId) === basename(target)
    )
    callback(found?.portId ?? '')
  })

  mainWindow.on('ready-to-show', () => {
    splashWindow?.close()
    splashWindow = null
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
      if (icon) app.dock?.setIcon(icon)
    }

    registerIpcHandlers(() => mainWindow)
    initUpdater(() => mainWindow)
    createSplash()
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
