// hooks/useDeviceState.ts — Shallow-stable bundle of the device-store
// slices the editor panels read in lockstep.
//
// Replaces the repeated `const x = useDeviceStore((s) => s.x)` boilerplate
// in `ScreenSettingsPanel` and (future) sibling editor panels (audit
// follow-up to #1207). `useShallow` keeps the bundle from re-rendering
// the panel when an unrelated device-store key changes.

import { useShallow } from 'zustand/react/shallow'
import { useDeviceStore } from '../stores/device.store'

export interface DeviceStateBundle {
  connected: boolean
  simulationMode: boolean
  isDayMode: boolean | null
  setIsDayMode: (isDay: boolean | null) => void
}

/**
 * Bundle of the device-store slices the editor panels read together.
 * Selects via `useShallow` so the panel only re-renders when one of these
 * specific keys changes.
 */
export function useDeviceState(): DeviceStateBundle {
  return useDeviceStore(
    useShallow((s) => ({
      connected: s.connected,
      simulationMode: s.simulationMode,
      isDayMode: s.isDayMode,
      setIsDayMode: s.setIsDayMode,
    }))
  )
}
