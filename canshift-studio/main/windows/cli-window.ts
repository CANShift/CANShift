// cli-window.ts — Lifecycle for the detached CLI BrowserWindow (issue #433).
//
// The detached window reuses the same renderer entry as the main window —
// `index.html` plus `src/main.tsx`. The renderer branches on a `?surface=cli`
// query string and mounts only `<CliTerminal detached />`, so the existing
// xterm lazy chunk is shared and the bundle budget doesn't regress.
//
// Lifecycle invariants:
//   • `openCliWindow()` is idempotent — calling it while a detached window
//     is already alive returns the existing windowId.
//   • Any way the window goes down (`closed`, `render-process-gone`,
//     explicit `closeCliWindow()`) ends with a single `CLI_STATE_CHANGED`
//     broadcast carrying `{ kind: 'inApp' }` so every other surface can
//     re-attach.
//   • Bounds are persisted on `close` — saving on every move/resize would
//     hammer userData unnecessarily.

import { BrowserWindow, shell } from 'electron'
import { join } from 'path'
import { IpcChannels } from '../ipc/ipc-channels'
import type { CliPanelState, CliStateChangedEvent } from '../ipc/cli-detach.types'
import {
  CLI_WINDOW_MIN_HEIGHT,
  CLI_WINDOW_MIN_WIDTH,
  loadCliWindowBounds,
  saveCliWindowBounds,
} from '../services/cli-window.service'
import { subscribe, unsubscribe } from '../services/cli-log-bus'
import { isExternalUrlAllowed } from '../services/security.service'

let cliWindow: BrowserWindow | null = null

function broadcastState(getMainWindow: () => BrowserWindow | null, state: CliPanelState): void {
  const event: CliStateChangedEvent = { state }
  const main = getMainWindow()
  if (main !== null && !main.isDestroyed()) {
    main.webContents.send(IpcChannels.CLI_STATE_CHANGED, event)
  }
  if (cliWindow !== null && !cliWindow.isDestroyed()) {
    cliWindow.webContents.send(IpcChannels.CLI_STATE_CHANGED, event)
  }
}

/**
 * Opens (or returns) the detached CLI window. The returned id is stable for
 * the window's lifetime so renderers can match `CLI_STATE_CHANGED` payloads.
 */
export function openCliWindow(getMainWindow: () => BrowserWindow | null): number {
  if (cliWindow !== null && !cliWindow.isDestroyed()) {
    return cliWindow.id
  }

  const bounds = loadCliWindowBounds()
  cliWindow = new BrowserWindow({
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
    minWidth: CLI_WINDOW_MIN_WIDTH,
    minHeight: CLI_WINDOW_MIN_HEIGHT,
    title: 'CS Studio — CLI',
    backgroundColor: '#0A0A0A',
    show: false,
    webPreferences: {
      preload: join(__dirname, '../preload/preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })

  const id = cliWindow.id

  // xterm's WebLinksAddon triggers window.open() on link clicks inside the
  // terminal. Route through the same allowlist the main window uses so a
  // malicious / file: scheme pasted into logs can't spawn an unsandboxed child.
  cliWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (isExternalUrlAllowed(url)) {
      void shell.openExternal(url)
    }
    return { action: 'deny' }
  })

  cliWindow.once('ready-to-show', () => {
    cliWindow?.show()
  })

  // Subscribe the detached window's webContents to the log bus so entries
  // produced in the main app window flow into the detached terminal.
  subscribe(cliWindow.webContents)

  cliWindow.on('close', () => {
    if (cliWindow === null || cliWindow.isDestroyed()) return
    saveCliWindowBounds(cliWindow.getBounds())
  })

  const teardown = (): void => {
    if (cliWindow !== null) {
      try {
        unsubscribe(cliWindow.webContents)
      } catch {
        // webContents may already be destroyed — ignore.
      }
    }
    cliWindow = null
    broadcastState(getMainWindow, { kind: 'inApp' })
  }

  cliWindow.on('closed', teardown)
  cliWindow.webContents.on('render-process-gone', teardown)

  if (process.env.ELECTRON_RENDERER_URL) {
    void cliWindow.loadURL(`${process.env.ELECTRON_RENDERER_URL}?surface=cli`)
  } else {
    void cliWindow.loadFile(join(__dirname, '../renderer/index.html'), {
      query: { surface: 'cli' },
    })
  }

  broadcastState(getMainWindow, { kind: 'detached', windowId: id })
  return id
}

/**
 * Closes the detached CLI window if open. The accompanying `closed` listener
 * is what actually broadcasts `CLI_STATE_CHANGED` — calling this against an
 * already-closed window is a no-op.
 */
export function closeCliWindow(): void {
  if (cliWindow !== null && !cliWindow.isDestroyed()) {
    cliWindow.close()
  }
}

/** Returns the live windowId or `null` when no detached window is open. */
export function getCliWindowState(): CliPanelState {
  if (cliWindow !== null && !cliWindow.isDestroyed()) {
    return { kind: 'detached', windowId: cliWindow.id }
  }
  return { kind: 'inApp' }
}

/**
 * Closes the detached window without touching the bounds file — used during
 * `before-quit` so we don't fight the renderer's normal shutdown sequence.
 */
export function disposeCliWindow(): void {
  if (cliWindow !== null && !cliWindow.isDestroyed()) {
    try {
      unsubscribe(cliWindow.webContents)
    } catch {
      // ignore
    }
    cliWindow.destroy()
  }
  cliWindow = null
}

/** Test-only — replaces the module-scope window reference. */
export const __testing = {
  setCliWindow(win: BrowserWindow | null): void {
    cliWindow = win
  },
  getCliWindow(): BrowserWindow | null {
    return cliWindow
  },
}
