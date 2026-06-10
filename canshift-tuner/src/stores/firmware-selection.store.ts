import { create } from 'zustand'
import type { LocalFirmware } from '../lib/firmware/local-firmware'

export type FirmwareSelection = { kind: 'none' } | { kind: 'local'; firmware: LocalFirmware }

interface FirmwareSelectionState {
  selection: FirmwareSelection
  setLocalFirmware: (firmware: LocalFirmware) => void
  clear: () => void
}

export const useFirmwareSelectionStore = create<FirmwareSelectionState>((set) => ({
  selection: { kind: 'none' },
  setLocalFirmware: (firmware) => {
    set({ selection: { kind: 'local', firmware } })
  },
  clear: () => {
    set({ selection: { kind: 'none' } })
  },
}))
