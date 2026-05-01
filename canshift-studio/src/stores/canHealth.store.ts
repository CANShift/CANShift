// canHealth.store.ts — Tracks CAN bus health stats pushed from the firmware.
//
// Updated every ~2 seconds when a CAN health packet arrives over USB.
// fps: frames per second received on the CAN bus
// errors: total TWAI receive errors since boot

import { create } from 'zustand'

interface CanHealthState {
  fps: number | null
  errors: number | null
  updatedAt: number | null

  update: (fps: number, errors: number) => void
}

export const useCanHealthStore = create<CanHealthState>()((set) => ({
  fps: null,
  errors: null,
  updatedAt: null,

  update: (fps, errors) => {
    set({ fps, errors, updatedAt: Date.now() })
  },
}))
