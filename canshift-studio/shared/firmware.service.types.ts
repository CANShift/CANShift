// firmware.service.types.ts — Cross-module types extracted from firmware.service.ts.
// Lives here so the renderer (via ipc.service.ts re-exports) and other main
// modules can consume the release shape without pulling in electron runtime.

export interface FirmwareRelease {
  version: string
  tag: string
  /** Undefined when the firmware binary asset is absent from this release. */
  downloadUrl?: string
  /** Undefined when the SPIFFS image asset is absent from this release. */
  spiffsUrl?: string
  /**
   * Size of the firmware binary asset in bytes (from GitHub `assets[].size`).
   * Used to render an estimated flash duration in the studio UI without an
   * extra HEAD request. Undefined when the asset is missing.
   */
  payloadBytes?: number
  publishedAt: string
  prerelease: boolean
  notes: string
}
