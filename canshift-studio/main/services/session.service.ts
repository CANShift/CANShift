// session.service.ts — Persist the last opened file path across restarts.
//
// Writes a small JSON file to Electron's userData directory.
// Errors are silently ignored — session restore is best-effort.

import { app } from 'electron'
import * as fs from 'fs'
import * as path from 'path'

interface SessionData {
  lastFilePath: string | null
}

function sessionPath(): string {
  return path.join(app.getPath('userData'), 'session.json')
}

function read(): SessionData {
  try {
    const raw = fs.readFileSync(sessionPath(), 'utf8')
    return JSON.parse(raw) as SessionData
  } catch {
    return { lastFilePath: null }
  }
}

function write(data: SessionData): void {
  try {
    fs.writeFileSync(sessionPath(), JSON.stringify(data))
  } catch {
    // Best-effort — ignore write errors (e.g. read-only fs)
  }
}

export const sessionService = {
  getLastFilePath: (): string | null => read().lastFilePath,
  setLastFilePath: (filePath: string): void => {
    write({ lastFilePath: filePath })
  },
  clear: (): void => {
    write({ lastFilePath: null })
  },
}
