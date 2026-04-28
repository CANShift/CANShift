// config-file.service.ts — Open and save dashboard config JSON files

import { dialog } from 'electron'
import { readFile, writeFile } from 'fs/promises'
import { join } from 'path'

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

export class ConfigFileService {
  private currentFilePath: string | null = null

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

  async saveFile(config: unknown): Promise<SaveResult> {
    if (!this.currentFilePath) {
      return this.saveFileAs(config)
    }

    try {
      await writeFile(this.currentFilePath, JSON.stringify(config, null, 2), 'utf-8')
      return { success: true, filePath: this.currentFilePath }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return { success: false, error: `Failed to save config: ${message}` }
    }
  }

  async saveFileAs(config: unknown): Promise<SaveResult> {
    const result = await dialog.showSaveDialog({
      title: 'Save Dashboard Config',
      defaultPath: this.currentFilePath ?? 'dashboard.json',
      filters: [
        { name: 'CANShift Config', extensions: ['json'] },
      ],
    })

    if (result.canceled || !result.filePath) {
      return { success: false }
    }

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
