// ota-flow.store.ts — Tracks in-session OTA download/verify progress so a
// Wi-Fi AP failure does not force a re-download + re-verify cycle (#1165).
//
// Persistence: in-memory only (store is reset on cold-start). This is
// acceptable because downloadFirmware() already caches the binary to disk
// and the re-verify step is fast (<1 s). AsyncStorage persistence is a
// follow-up if cold-start resumability is required.

import { create } from 'zustand'
import type { FirmwareRelease } from '../services/ota.service'

export interface OtaFlowState {
  stage: 'idle' | 'downloaded' | 'verified'
  release: FirmwareRelease | null
  localPath: string | null
  /** Lowercase hex SHA-256 of the release asset (from GitHub metadata). */
  verifiedSha: string | null
  /** Unix epoch ms when verification completed. */
  verifiedAt: number | null
  setDownloaded: (release: FirmwareRelease, path: string) => void
  setVerified: (release: FirmwareRelease, path: string, sha: string) => void
  clear: () => void
}

const INITIAL_STATE = {
  stage: 'idle' as const,
  release: null,
  localPath: null,
  verifiedSha: null,
  verifiedAt: null,
}

export const useOtaFlowStore = create<OtaFlowState>((set) => ({
  ...INITIAL_STATE,
  setDownloaded: (release, path) => {
    set({ stage: 'downloaded', release, localPath: path, verifiedSha: null, verifiedAt: null })
  },
  setVerified: (release, path, sha) => {
    set({ stage: 'verified', release, localPath: path, verifiedSha: sha, verifiedAt: Date.now() })
  },
  clear: () => {
    set(INITIAL_STATE)
  },
}))
