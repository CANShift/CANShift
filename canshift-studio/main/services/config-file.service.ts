// config-file.service.ts — Open and save dashboard config JSON files

import { dialog } from 'electron'
import { readFile, writeFile } from 'fs/promises'
import { resolve } from 'node:path'
import { sessionService } from './session.service'

interface OpenResult {
  success: boolean
  filePath?: string
  content?: unknown
  error?: string
}

interface SaveResult {
  success: boolean
  filePath?: string
  error?: string
}

// Renderer-supplied paths must match a path the user previously surfaced through
// a dialog or recent-files entry. Without this, a compromised renderer could
// invoke CONFIG_OPEN_PATH to read any user-readable file (#214). The error
// message intentionally omits the rejected path so we don't leak FS structure.
const PATH_NOT_SURFACED_ERROR = 'blocked: path not previously surfaced'

export class ConfigFileService {
  private currentFilePath: string | null = null
  private readonly allowedPaths = new Set<string>()

  constructor(getRecentFiles: () => string[] = sessionService.getRecentFiles) {
    // Persisted recent-files survive restarts, so seeding the allowlist with
    // them lets the menu's "Open Recent" stay functional after a relaunch.
    for (const filePath of getRecentFiles()) {
      this.allowPath(filePath)
    }
  }

  private allowPath(filePath: string): void {
    this.allowedPaths.add(resolve(filePath))
  }

  private isPathAllowed(filePath: string): boolean {
    return this.allowedPaths.has(resolve(filePath))
  }

  async openFile(): Promise<OpenResult> {
    const result = await dialog.showOpenDialog({
      title: 'Open Dashboard Config',
      filters: [
        { name: 'CANShift Config', extensions: ['json'] },
        { name: 'All Files', extensions: ['*'] },
      ],
      properties: ['openFile'],
    })

    if (result.canceled || result.filePaths.length === 0) {
      return { success: false }
    }

    const filePath = result.filePaths[0]
    if (!filePath) return { success: false }

    this.allowPath(filePath)

    try {
      const raw = await readFile(filePath, 'utf-8')
      const content: unknown = JSON.parse(raw)
      this.currentFilePath = filePath
      return { success: true, filePath, content }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return { success: false, error: `Failed to read config: ${message}` }
    }
  }

  /**
   * Save config to disk.
   * @param config  The dashboard config to serialise.
   * @param filePath  Explicit destination path. Falls back to `currentFilePath`;
   *                  if neither is set, delegates to `saveFileAs` (shows a dialog).
   */
  async saveFile(config: unknown, filePath?: string): Promise<SaveResult> {
    const targetPath = filePath ?? this.currentFilePath
    if (!targetPath) {
      return this.saveFileAs(config)
    }

    try {
      await writeFile(targetPath, JSON.stringify(config, null, 2), 'utf-8')
      this.currentFilePath = targetPath
      this.allowPath(targetPath)
      return { success: true, filePath: targetPath }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return { success: false, error: `Failed to save config: ${message}` }
    }
  }

  async openFilePath(filePath: string): Promise<OpenResult> {
    if (!this.isPathAllowed(filePath)) {
      return { success: false, error: PATH_NOT_SURFACED_ERROR }
    }

    try {
      const raw = await readFile(filePath, 'utf-8')
      const content: unknown = JSON.parse(raw)
      this.currentFilePath = filePath
      return { success: true, filePath, content }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return { success: false, error: `Failed to read config: ${message}` }
    }
  }

  /**
   * Import a config JSON without binding it as the working file. Used for
   * loading shared dashboards — the editor treats the result as a new unsaved
   * document so a subsequent Save prompts for a fresh location.
   */
  async importFile(): Promise<OpenResult> {
    const result = await dialog.showOpenDialog({
      title: 'Import Dashboard',
      filters: [
        { name: 'CANShift Config', extensions: ['json'] },
        { name: 'All Files', extensions: ['*'] },
      ],
      properties: ['openFile'],
    })

    if (result.canceled || result.filePaths.length === 0) {
      return { success: false }
    }

    const filePath = result.filePaths[0]
    if (!filePath) return { success: false }

    try {
      const raw = await readFile(filePath, 'utf-8')
      const content: unknown = JSON.parse(raw)
      return { success: true, filePath, content }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return { success: false, error: `Failed to read config: ${message}` }
    }
  }

  /**
   * Export a snapshot of the config to a chosen path without changing the
   * working file path. Useful for backups and sharing where the in-editor
   * working file shouldn't be retargeted.
   */
  async exportFile(config: unknown): Promise<SaveResult> {
    const result = await dialog.showSaveDialog({
      title: 'Export Dashboard',
      defaultPath: 'dashboard.json',
      filters: [{ name: 'CANShift Config', extensions: ['json'] }],
    })

    if (result.canceled || !result.filePath) {
      return { success: false }
    }

    this.allowPath(result.filePath)

    try {
      await writeFile(result.filePath, JSON.stringify(config, null, 2), 'utf-8')
      return { success: true, filePath: result.filePath }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return { success: false, error: `Failed to export config: ${message}` }
    }
  }

  async saveFileAs(config: unknown): Promise<SaveResult> {
    const result = await dialog.showSaveDialog({
      title: 'Save Dashboard Config',
      defaultPath: this.currentFilePath ?? 'dashboard.json',
      filters: [{ name: 'CANShift Config', extensions: ['json'] }],
    })

    if (result.canceled || !result.filePath) {
      return { success: false }
    }

    this.allowPath(result.filePath)

    try {
      await writeFile(result.filePath, JSON.stringify(config, null, 2), 'utf-8')
      this.currentFilePath = result.filePath
      return { success: true, filePath: result.filePath }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return { success: false, error: `Failed to save config: ${message}` }
    }
  }
}
