// session.service.ts — Persist session state (last file, recent files, first-run) across restarts.
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
  firstRunCompleted: boolean
}

const MAX_RECENT = 10

function sessionPath(): string {
  return path.join(app.getPath('userData'), 'session.json')
}

/**
 * Treat any of these signals as "this user has used Studio before" and skip
 * onboarding on upgrade. Avoids re-onboarding power users when the firstRun
 * field is added to existing session.json files.
 */
function hasLegacyUsageSignals(parsed: Partial<SessionData>): boolean {
  const hasLastFile = typeof parsed.lastFilePath === 'string' && parsed.lastFilePath.length > 0
  const hasRecent = Array.isArray(parsed.recentFiles) && parsed.recentFiles.length > 0
  const hasLastPort = typeof parsed.lastPortPath === 'string' && parsed.lastPortPath.length > 0
  return hasLastFile || hasRecent || hasLastPort
}

// In-memory cache of the parsed session file. Studio is a single-process
// Electron app so the file is never written by anyone else — reading once on
// first access and serving subsequent gets from memory keeps sync FS off the
// main thread (menu rebuild + useSessionRestore + IPC invokes used to fire
// several disk reads per startup).
let cache: SessionData | null = null

function readFromDisk(): SessionData {
  try {
    const raw = fs.readFileSync(sessionPath(), 'utf8')
    const data = JSON.parse(raw) as Partial<SessionData>
    const firstRunCompleted =
      typeof data.firstRunCompleted === 'boolean'
        ? data.firstRunCompleted
        : hasLegacyUsageSignals(data)
    return {
      lastFilePath: data.lastFilePath ?? null,
      recentFiles: Array.isArray(data.recentFiles) ? data.recentFiles : [],
      lastPortPath: data.lastPortPath ?? null,
      firstRunCompleted,
    }
  } catch {
    return { lastFilePath: null, recentFiles: [], lastPortPath: null, firstRunCompleted: false }
  }
}

function read(): SessionData {
  if (cache === null) cache = readFromDisk()
  return cache
}

function write(data: SessionData): void {
  cache = data
  try {
    fs.writeFileSync(sessionPath(), JSON.stringify(data))
  } catch {
    // Best-effort — ignore write errors. The in-memory cache still reflects the
    // intended state so subsequent reads in this process see the new value.
  }
}

export const sessionService: {
  getLastFilePath: () => string | null
  getRecentFiles: () => string[]
  addRecentFile: (filePath: string) => void
  clearRecentFiles: () => void
  getLastPortPath: () => string | null
  setLastPortPath: (portPath: string | null) => void
  getFirstRunCompleted: () => boolean
  markFirstRunCompleted: () => void
  resetFirstRun: () => void
  clear: () => void
} = {
  getLastFilePath: (): string | null => read().lastFilePath,

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

  getFirstRunCompleted: (): boolean => read().firstRunCompleted,

  markFirstRunCompleted: (): void => {
    const data = read()
    write({ ...data, firstRunCompleted: true })
  },

  resetFirstRun: (): void => {
    const data = read()
    write({ ...data, firstRunCompleted: false })
  },

  clear: (): void => {
    write({
      lastFilePath: null,
      recentFiles: [],
      lastPortPath: null,
      firstRunCompleted: false,
    })
  },
}
