// config-file.service.ts — Open and save dashboard config JSON files

import { dialog } from 'electron'
import { readFile, writeFile, stat } from 'fs/promises'
import { resolve } from 'node:path'
import type { OpenResult, SaveResult } from '../../shared/ipc-contract'
import { sessionService } from './session.service'

// Renderer-supplied paths must match a path the user previously surfaced through
// a dialog or recent-files entry. Without this, a compromised renderer could
// invoke CONFIG_OPEN_PATH to read any user-readable file (#214). The error
// message intentionally omits the rejected path so we don't leak FS structure.
const PATH_NOT_SURFACED_ERROR = 'blocked: path not previously surfaced'

// Hard ceiling on the JSON config file size. The current schema serialises to
// ~13 KB; 1 MiB is two orders of magnitude of headroom for future schema
// growth while denying a 2 GB file from OOMing the main process at JSON.parse
// (#900). Anything legitimately larger should land via a dedicated import
// path (firmware bundle, asset stream) not the config open path.
const MAX_CONFIG_BYTES = 1024 * 1024

// ---------------------------------------------------------------------------
// Safe error codes (umbrella #1018, SEC-L-1)
// ---------------------------------------------------------------------------
//
// Previous behaviour bubbled raw OS errno strings (e.g.
// "ENOENT: no such file or directory, open '/Users/foo/.ssh/id_rsa'") through
// IPC to the renderer. That leaks both the actual filesystem layout the main
// process can see AND the platform's libuv-mapped error vocabulary. Collapse
// to a small, stable set so the renderer surface stays opaque. The full
// underlying error is still logged server-side via the main-process console
// (see logFileError below) so debugging stays possible.
export type ConfigFileErrorCode = 'not_found' | 'permission_denied' | 'io_error' | 'invalid_path'

interface NodeFsError {
  code?: string
}

function isNodeFsError(err: unknown): err is NodeFsError {
  return typeof err === 'object' && err !== null && 'code' in err
}

/**
 * Map a thrown filesystem error to one of the safe codes. SyntaxError from
 * `JSON.parse` is treated as `invalid_path` because the file was readable but
 * not a valid config — surfacing `io_error` for that case would be misleading.
 */
export function mapFileError(err: unknown): ConfigFileErrorCode {
  if (err instanceof SyntaxError) return 'invalid_path'
  if (isNodeFsError(err)) {
    switch (err.code) {
      case 'ENOENT':
        return 'not_found'
      case 'EACCES':
      case 'EPERM':
        return 'permission_denied'
      case 'EISDIR':
      case 'ENOTDIR':
      case 'EINVAL':
        return 'invalid_path'
      default:
        return 'io_error'
    }
  }
  return 'io_error'
}

/**
 * Log the raw error to the main-process console so an operator running with
 * `--enable-logging` can still see the underlying errno. The renderer never
 * sees this string.
 */
function logFileError(context: string, err: unknown): void {
  const message = err instanceof Error ? err.message : String(err)
  console.warn(`[config-file] ${context}: ${message}`)
}

async function readConfigJson(filePath: string): Promise<unknown> {
  const stats = await stat(filePath)
  if (stats.size > MAX_CONFIG_BYTES) {
    throw new Error(
      `Config file exceeds ${String(MAX_CONFIG_BYTES)} bytes (got ${String(stats.size)}); refusing to load`
    )
  }
  const raw = await readFile(filePath, 'utf-8')
  return JSON.parse(raw) as unknown
}

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
      const content = await readConfigJson(filePath)
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
      const content = await readConfigJson(filePath)
      this.currentFilePath = filePath
      return { success: true, filePath, content }
    } catch (err) {
      // Collapse to a safe code so OS errno strings and absolute paths never
      // reach the renderer (#1018, SEC-L-1). The full error is logged
      // server-side so debugging stays possible.
      logFileError('openFilePath', err)
      return { success: false, error: mapFileError(err) }
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
      const content = await readConfigJson(filePath)
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
