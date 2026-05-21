// main/index.ts — Electron main process entry point

import { app, BrowserWindow, dialog, ipcMain, shell, nativeImage } from 'electron'
import { join, basename } from 'path'
import { disposeIpcHandlers, registerIpcHandlers, usbService } from './ipc/ipc-handlers'
import { buildMenu } from './menu'
import { initUpdater } from './services/updater.service'
import { firmwareService } from './services/firmware.service'
import { installContentSecurityPolicy, isExternalUrlAllowed } from './services/security.service'
import { IpcChannels } from '../shared/ipc-channels'
import { disposeCliWindow } from './windows/cli-window'
import { subscribe as subscribeLog } from './services/cli-log-bus'

let mainWindow: BrowserWindow | null = null

// USB-UART bridges shipped on supported CANShift boards (CH340, CH9102, CP210x).
// Used to gate Web Serial device permission AND auto-pick a flash port.
// VID/PID pairs are in hex; Electron reports vendorId/productId as decimal numbers.
const ALLOWED_VID_PID: readonly (readonly [number, number])[] = [
  [0x1a86, 0x7523], // CH340
  [0x1a86, 0x55d4], // CH9102
  [0x10c4, 0xea60], // CP210x
]

function isAllowedSerialDevice(
  vendorId: number | undefined,
  productId: number | undefined
): boolean {
  if (vendorId === undefined || productId === undefined) return false
  return ALLOWED_VID_PID.some(([vid, pid]) => vid === vendorId && pid === productId)
}

// Latest dirty flag pushed by the renderer — used to prompt before close.
let configIsDirty = false
// True after the user confirms "Discard changes" so the next close goes through.
let confirmedClose = false

ipcMain.on(IpcChannels.WINDOW_SET_DIRTY, (_e, dirty: unknown) => {
  configIsDirty = Boolean(dirty)
})

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
      sandbox: true,
      // Pin same-origin + mixed-content denial defensively so a future
      // Electron default flip can't regress us (issue #913).
      webSecurity: true,
      allowRunningInsecureContent: false,
    },
  })

  // The main window is always a log-bus subscriber so log entries produced in
  // a detached CLI window flow back into the in-app surface. cli-log-bus
  // prunes destroyed WebContents lazily on the next publish, so the stale
  // subscription left behind when the window closes is harmless — and the
  // fresh BrowserWindow built on macOS dock re-open re-subscribes here.
  subscribeLog(mainWindow.webContents)

  // Web Serial API — gate permission to the known CANShift USB-UART bridges only.
  // Without the per-device filter, any renderer call to navigator.serial.requestPort()
  // could be auto-granted access to unrelated USB-CDC devices (3D printers,
  // programmers, GPS modules). The renderer uses Web Serial only during firmware
  // flashing, where the target is always a CH340 / CH9102 / CP210x bridge.
  mainWindow.webContents.session.setPermissionCheckHandler((_wc, permission) => {
    return permission === 'serial'
  })
  mainWindow.webContents.session.setDevicePermissionHandler((details) => {
    if (details.deviceType !== 'serial') return false
    const d = details.device as { vendorId?: number; productId?: number }
    return isAllowedSerialDevice(d.vendorId, d.productId)
  })
  // Log a marker on startup so the user can verify the latest main build is running
  mainWindow.webContents.once('did-finish-load', () => {
    logMain('info', 'Main process build: select-serial-port v2 active')
  })

  mainWindow.webContents.session.on('select-serial-port', (event, portList, _wc, callback) => {
    event.preventDefault()
    const target = firmwareService.getFlashPort()

    // CrowPanel and similar boards expose a CH340 / CP210x / CH9102 USB-to-UART chip.
    // VID/PID auto-pick is only used when no explicit target is set — when a target is
    // selected we must NEVER guess by VID/PID, otherwise esptool could be handed the
    // wrong device (e.g. a second CH340) and brick it.
    // Electron reports vendorId/productId as decimal strings on macOS — convert to hex.
    const toHex4 = (v: string | undefined): string => {
      const n = parseInt(v ?? '0', 10)
      return Number.isNaN(n) ? '' : n.toString(16).padStart(4, '0')
    }
    const allowedKeys = ALLOWED_VID_PID.map(
      ([vid, pid]) => `${vid.toString(16).padStart(4, '0')}:${pid.toString(16).padStart(4, '0')}`
    )
    const isCanShiftBridge = (p: Electron.SerialPort): boolean => {
      const key = `${toHex4(p.vendorId)}:${toHex4(p.productId)}`
      return allowedKeys.includes(key)
    }

    // macOS exposes the same USB serial port at both /dev/tty.* and /dev/cu.*.
    // Strip the prefix so 'tty.usbserial-2130' matches Chromium's 'cu.usbserial-2130'.
    const tail = (s: string | undefined): string => basename(s ?? '').replace(/^(?:tty|cu)\./, '')

    // Scrub vendorId / productId / serialNumber out of the log payload. The
    // raw `portList` carries the device's USB serial number, which is often
    // bound to the user's hardware identity — emitting it into the studio log
    // surface (and any future "send diagnostics" feature) would leak a stable
    // hardware fingerprint (#900). Only the port path is useful for debugging.
    const scrubPorts = (ports: readonly Electron.SerialPort[]): { portName: string }[] =>
      ports.map((p) => ({ portName: p.portName }))

    if (target) {
      const targetTail = tail(target)
      const matched =
        portList.find((p) => p.portId === target) ??
        portList.find((p) => tail(p.portName) === targetTail) ??
        portList.find((p) => tail(p.portId) === targetTail)

      if (matched) {
        logMain(
          'info',
          `select-serial-port: target=${target} match=${matched.portId} portList=${JSON.stringify(scrubPorts(portList))}`
        )
        callback(matched.portId)
        return
      }

      logMain(
        'warn',
        `select-serial-port: target ${target} not found among ${String(portList.length)} ports — letting user choose (no VID/PID fallback) portList=${JSON.stringify(scrubPorts(portList))}`
      )
      callback('')
      return
    }

    // No target set — fall back to VID/PID auto-pick. Surface ambiguity so the user
    // can spot when multiple compatible bridges are connected at once.
    const bridgeMatches = portList.filter(isCanShiftBridge)
    const picked = bridgeMatches[0]

    if (bridgeMatches.length > 1) {
      logMain(
        'warn',
        `select-serial-port: ${String(bridgeMatches.length)} VID/PID matches — auto-picked ${picked?.portId ?? 'none'} (set a target to disambiguate) portList=${JSON.stringify(scrubPorts(portList))}`
      )
    } else if (picked && portList.length > 0 && picked.portId !== portList[0]?.portId) {
      logMain(
        'info',
        `select-serial-port: auto-picked ${picked.portId} (not first in list) portList=${JSON.stringify(scrubPorts(portList))}`
      )
    } else {
      logMain(
        'info',
        `select-serial-port: target=null match=${picked?.portId ?? 'none'} portList=${JSON.stringify(scrubPorts(portList))}`
      )
    }
    callback(picked?.portId ?? '')
  })

  // No separate splash window — the in-app `BootScreen` React overlay is the
  // single splash surface. We keep `show: false` so the BrowserWindow stays
  // hidden until the renderer has at least the first paint ready
  // (`ready-to-show`), then reveal — that way the dock icon bounces into a
  // window already painting the BootScreen instead of a blank canvas. A
  // 10 s safety timer still fires `show()` if the renderer never signals,
  // so a stalled boot can never leave us with no visible window (#699 — the
  // original concern that motivated the native splash teardown, now scoped
  // to the same belt-and-suspenders we want for the main window itself).
  const RENDERER_SHOW_TIMEOUT_MS = 10_000

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()
    if (mainWindow) buildMenu(mainWindow)
  })

  mainWindow.webContents.on('did-fail-load', (_e, code, description) => {
    logMain('error', `Renderer did-fail-load (${String(code)}): ${description}`)
    mainWindow?.show()
  })

  mainWindow.webContents.on('render-process-gone', (_e, details) => {
    logMain('error', `Renderer process gone: ${details.reason}`)
  })

  setTimeout(() => {
    if (mainWindow !== null && !mainWindow.isDestroyed() && !mainWindow.isVisible()) {
      logMain('warn', `Window-show safety timer fired — renderer never signalled ready-to-show`)
      mainWindow.show()
    }
  }, RENDERER_SHOW_TIMEOUT_MS)

  // Prompt before closing the window if there are unsaved config changes.
  // The renderer keeps `configIsDirty` in sync via WINDOW_SET_DIRTY.
  // Keep the detached CLI window in lockstep with the main window — closing
  // the main app should never leave a phantom CLI window alive.
  mainWindow.on('closed', () => {
    disposeCliWindow()
    // Null out the destroyed BrowserWindow reference so late callers
    // (select-serial-port, safeSend, logMain) see a falsy mainWindow and
    // short-circuit instead of touching a freed native handle.
    mainWindow = null
  })

  mainWindow.on('close', (event) => {
    if (!configIsDirty || confirmedClose) return
    event.preventDefault()
    if (!mainWindow) return
    const choice = dialog.showMessageBoxSync(mainWindow, {
      type: 'warning',
      buttons: ['Discard', 'Cancel'],
      defaultId: 1,
      cancelId: 1,
      title: 'Unsaved changes',
      message: 'You have unsaved changes to the dashboard config.',
      detail:
        'Closing now will lose any edits made since the last save. Save the file first if you want to keep them.',
    })
    if (choice === 0) {
      confirmedClose = true
      mainWindow.close()
    }
  })

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (isExternalUrlAllowed(url)) {
      void shell.openExternal(url)
    } else {
      logMain('warn', `Blocked openExternal for disallowed URL scheme: ${url}`)
    }
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

    installContentSecurityPolicy()
    registerIpcHandlers(() => mainWindow)
    initUpdater(() => mainWindow)
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
  // Close USB port if open. Best-effort: the app is quitting either way, but
  // log the failure so a wedged port doesn't disappear silently from the
  // diagnostics (project rule "no empty catch", issue #914).
  usbService.disconnect().catch((err: unknown) => {
    logMain(
      'warn',
      `USB disconnect on quit failed: ${err instanceof Error ? err.message : String(err)}`
    )
  })
  // Stop the 10 Hz CAN-frame flush interval so Node's event loop can drain.
  disposeIpcHandlers()
  // Clear flash port so Web Serial auto-select is reset on next launch
  firmwareService.setFlashPort(null)
  // Tear down the detached CLI window so it doesn't keep the app alive.
  disposeCliWindow()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
