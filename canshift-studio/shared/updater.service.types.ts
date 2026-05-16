// updater.service.types.ts — Cross-module types extracted from updater.service.ts.
// Lives here so the renderer (via ipc.service.ts re-exports) can consume the
// auto-update IPC payload shapes without pulling in electron-updater.

export interface UpdateAvailablePayload {
  version: string
  releaseDate: string
  /** Plain text only — sanitized in main; never raw markdown or HTML. */
  releaseNotesPlain: string
}

export interface UpdateErrorPayload {
  message: string
}
