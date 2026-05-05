// session.service.ts — Persist session state (last file, recent files) across restarts.
//
// Writes a small JSON file to Electron's userData directory.
// Errors are silently ignored — session restore is best-effort.

import { app } from 'electron'
import * as fs from 'fs'
import * as path from 'path'

interface SessionData {
  lastFilePath: string | null
  recentFiles: string[]
  lastPortPath: string | null
}

const MAX_RECENT = 10

function sessionPath(): string {
  return path.join(app.getPath('userData'), 'session.json')
}

function read(): SessionData {
  try {
    const raw = fs.readFileSync(sessionPath(), 'utf8')
    const data = JSON.parse(raw) as Partial<SessionData>
    return {
      lastFilePath: data.lastFilePath ?? null,
      recentFiles: Array.isArray(data.recentFiles) ? data.recentFiles : [],
      lastPortPath: data.lastPortPath ?? null,
    }
  } catch {
    return { lastFilePath: null, recentFiles: [], lastPortPath: null }
  }
}

function write(data: SessionData): void {
  try {
    fs.writeFileSync(sessionPath(), JSON.stringify(data))
  } catch {
    // Best-effort — ignore write errors
  }
}

export const sessionService: {
  getLastFilePath: () => string | null
  setLastFilePath: (filePath: string) => void
  getRecentFiles: () => string[]
  addRecentFile: (filePath: string) => void
  clearRecentFiles: () => void
  getLastPortPath: () => string | null
  setLastPortPath: (portPath: string | null) => void
  clear: () => void
} = {
  getLastFilePath: (): string | null => read().lastFilePath,

  setLastFilePath: (filePath: string): void => {
    const data = read()
    write({ ...data, lastFilePath: filePath })
  },

  getRecentFiles: (): string[] => read().recentFiles,

  addRecentFile: (filePath: string): void => {
    const data = read()
    const deduped = data.recentFiles.filter((f) => f !== filePath)
    write({
      ...data,
      lastFilePath: filePath,
      recentFiles: [filePath, ...deduped].slice(0, MAX_RECENT),
    })
  },

  clearRecentFiles: (): void => {
    const data = read()
    write({ ...data, recentFiles: [] })
  },

  getLastPortPath: (): string | null => read().lastPortPath,

  setLastPortPath: (portPath: string | null): void => {
    const data = read()
    write({ ...data, lastPortPath: portPath })
  },

  clear: (): void => {
    write({ lastFilePath: null, recentFiles: [], lastPortPath: null })
  },
}
