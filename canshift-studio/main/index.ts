// main/index.ts — Electron main process entry point

import { app, BrowserWindow, shell, nativeImage } from 'electron'
import { join, basename } from 'path'
import { readFileSync } from 'fs'
import { registerIpcHandlers, usbService } from './ipc/ipc-handlers'
import { buildMenu } from './menu'
import { initUpdater } from './services/updater.service'
import { firmwareService } from './services/firmware.service'
import { IpcChannels } from './ipc/ipc-channels'

let mainWindow: BrowserWindow | null = null
let splashWindow: BrowserWindow | null = null

// ---------------------------------------------------------------------------
// Structured logging — forwards main-process messages to the renderer console
// ---------------------------------------------------------------------------

function logMain(level: 'info' | 'warn' | 'error', message: string): void {
  const now = new Date()
  const hh = String(now.getHours()).padStart(2, '0')
  const mm = String(now.getMinutes()).padStart(2, '0')
  const ss = String(now.getSeconds()).padStart(2, '0')
  const prefix = `[${hh}:${mm}:${ss}] [${level.toUpperCase()}]`
  if (level === 'error') {
    console.error(`${prefix} ${message}`)
  } else {
    console.log(`${prefix} ${message}`)
  }
  mainWindow?.webContents.send(IpcChannels.APP_LOG, { level, message, ts: Date.now() })
}

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
  // Log a marker on startup so the user can verify the latest main build is running
  mainWindow.webContents.once('did-finish-load', () => {
    logMain('info', 'Main process build: select-serial-port v2 active')
  })

  mainWindow.webContents.session.on('select-serial-port', (event, portList, _wc, callback) => {
    event.preventDefault()
    const target = firmwareService.getFlashPort()

    // CrowPanel and similar boards expose a CH340 / CP210x / CH9102 USB-to-UART chip.
    // We rely on VID/PID detection because the renderer must call requestPort()
    // synchronously after the user gesture (before any await — including enterFlash IPC),
    // so `target` may not be set yet when this event fires.
    // Electron reports vendorId/productId as decimal strings on macOS — convert to hex.
    const toHex4 = (v: string | undefined): string => {
      const n = parseInt(v ?? '0', 10)
      return Number.isNaN(n) ? '' : n.toString(16).padStart(4, '0')
    }
    const isCanShiftBridge = (p: Electron.SerialPort): boolean => {
      const key = `${toHex4(p.vendorId)}:${toHex4(p.productId)}`
      return ['1a86:7523', '1a86:55d4', '10c4:ea60'].includes(key)
    }

    // macOS exposes the same USB serial port at both /dev/tty.* and /dev/cu.*.
    // Strip the prefix so 'tty.usbserial-2130' matches Chromium's 'cu.usbserial-2130'.
    const tail = (s: string | undefined): string => basename(s ?? '').replace(/^(?:tty|cu)\./, '')

    let found: Electron.SerialPort | undefined
    if (target) {
      const targetTail = tail(target)
      found =
        portList.find((p) => p.portId === target) ??
        portList.find((p) => tail(p.portName) === targetTail) ??
        portList.find((p) => tail(p.portId) === targetTail)
    }
    found = found ?? portList.find(isCanShiftBridge)

    logMain(
      'info',
      `select-serial-port: target=${target ?? 'null'} match=${found?.portId ?? 'none'} portList=${JSON.stringify(portList)}`
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
    logMain('error', `App failed to start: ${err instanceof Error ? err.message : String(err)}`)
    app.quit()
  })

app.on('before-quit', () => {
  // Close USB port if open — best-effort, errors are intentionally swallowed
  usbService.disconnect().catch(() => {
    /* best-effort */
  })
  // Clear flash port so Web Serial auto-select is reset on next launch
  firmwareService.setFlashPort(null)
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
