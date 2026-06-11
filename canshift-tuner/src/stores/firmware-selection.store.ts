import { create } from 'zustand'
import type { ReleaseInfo } from '@tmbk/canshift-core'
import type { LocalFirmware } from '../lib/firmware/local-firmware'

export type FirmwareSelection =
  | { kind: 'none' }
  | { kind: 'local'; firmware: LocalFirmware }
  | { kind: 'release'; release: ReleaseInfo; firmware: LocalFirmware }

interface FirmwareSelectionState {
  selection: FirmwareSelection
  setLocalFirmware: (firmware: LocalFirmware) => void
  setReleaseFirmware: (release: ReleaseInfo, firmware: LocalFirmware) => void
  clear: () => void
}

export const useFirmwareSelectionStore = create<FirmwareSelectionState>((set) => ({
  selection: { kind: 'none' },
  setLocalFirmware: (firmware) => {
    set({ selection: { kind: 'local', firmware } })
  },
  setReleaseFirmware: (release, firmware) => {
    set({ selection: { kind: 'release', release, firmware } })
  },
  clear: () => {
    set({ selection: { kind: 'none' } })
  },
}))
