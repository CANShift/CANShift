// updater.service.ts — Electron auto-update via GitHub Releases
//
// Uses electron-updater to check for new versions on startup (silent check).
// Sends IPC events to the renderer when an update is available or downloaded.
// Only runs when the app is packaged — no-ops in dev mode.
//
// Security (issue #240): `info.releaseNotes` is the GitHub release body, an
// untrusted upstream string that may contain markdown and raw HTML. We reduce
// it to bounded plain text here, before the value ever crosses the IPC
// boundary, so any future "What's new" UI cannot accidentally render markup.
// The renderer-facing field is named `releaseNotesPlain` to make that
// guarantee explicit at the type level.

import { autoUpdater, UpdateInfo } from 'electron-updater'
import type { BrowserWindow } from 'electron'
import { IpcChannels } from '../ipc/ipc-channels'
import { markdownToPlainText } from '../utils/markdown-to-plain-text'

export interface UpdateAvailablePayload {
  version: string
  releaseDate: string
  /** Plain text only — sanitized in main; never raw markdown or HTML. */
  releaseNotesPlain: string
}

export interface UpdateErrorPayload {
  message: string
}

function buildPayload(info: UpdateInfo): UpdateAvailablePayload {
  return {
    version: info.version,
    releaseDate: info.releaseDate,
    releaseNotesPlain: markdownToPlainText(info.releaseNotes),
  }
}

export function initUpdater(getWindow: () => BrowserWindow | null): void {
  // Disable in dev — electron-updater requires a packaged app to function
  if (process.env.ELECTRON_RENDERER_URL !== undefined) return

  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = false

  autoUpdater.on('update-available', (info: UpdateInfo) => {
    getWindow()?.webContents.send(IpcChannels.UPDATE_AVAILABLE, buildPayload(info))
  })

  autoUpdater.on('update-downloaded', (info: UpdateInfo) => {
    getWindow()?.webContents.send(IpcChannels.UPDATE_DOWNLOADED, buildPayload(info))
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
