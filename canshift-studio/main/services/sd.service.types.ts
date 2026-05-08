// sd.service.types.ts — Cross-module types extracted from sd.service.ts.
// Lives here so the renderer (via ipc.service.ts re-exports) and other main
// modules can consume these shapes without pulling in node:fs runtime deps.

export interface SdVolume {
  path: string
  label: string
}

export interface SdPrepareResult {
  success: boolean
  copied: string[]
  skipped: string[]
  error?: string
}

export interface SdPushProgress {
  fileIndex: number
  totalFiles: number
  relPath: string
}
