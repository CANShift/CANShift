// updater.service.ts — Electron auto-update via GitHub Releases
//
// Uses electron-updater to check for new versions on startup (silent check).
// Sends IPC events to the renderer when an update is available or downloaded.
// Only runs when the app is packaged — no-ops in dev mode.

import { autoUpdater, UpdateInfo } from 'electron-updater'
import type { BrowserWindow } from 'electron'
import { IpcChannels } from '../ipc/ipc-channels'

export interface UpdateAvailablePayload {
  version: string
  releaseDate: string
  releaseNotes: string
}

export interface UpdateErrorPayload {
  message: string
}

export function initUpdater(getWindow: () => BrowserWindow | null): void {
  // Disable in dev — electron-updater requires a packaged app to function
  if (process.env.ELECTRON_RENDERER_URL !== undefined) return

  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = false

  autoUpdater.on('update-available', (info: UpdateInfo) => {
    const payload: UpdateAvailablePayload = {
      version: info.version,
      releaseDate: info.releaseDate,
      releaseNotes: typeof info.releaseNotes === 'string' ? info.releaseNotes : '',
    }
    getWindow()?.webContents.send(IpcChannels.UPDATE_AVAILABLE, payload)
  })

  autoUpdater.on('update-downloaded', (info: UpdateInfo) => {
    const payload: UpdateAvailablePayload = {
      version: info.version,
      releaseDate: info.releaseDate,
      releaseNotes: typeof info.releaseNotes === 'string' ? info.releaseNotes : '',
    }
    getWindow()?.webContents.send(IpcChannels.UPDATE_DOWNLOADED, payload)
  })

  autoUpdater.on('error', (err: Error) => {
    const payload: UpdateErrorPayload = { message: err.message }
    getWindow()?.webContents.send(IpcChannels.UPDATE_ERROR, payload)
  })

  // Silent check 3 seconds after startup so the UI has time to render first
  setTimeout(() => {
    void autoUpdater.checkForUpdates()
  }, 3000)
}

export function checkForUpdates(): void {
  void autoUpdater.checkForUpdates()
}

export function installUpdate(): void {
  autoUpdater.quitAndInstall(false, true)
}
