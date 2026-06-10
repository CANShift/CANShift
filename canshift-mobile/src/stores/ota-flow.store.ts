import { create } from 'zustand'
import type { FirmwareRelease } from '../services/ota.service'

export interface OtaFlowState {
  stage: 'idle' | 'downloaded' | 'verified'
  release: FirmwareRelease | null
  localPath: string | null
  verifiedSha: string | null
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
