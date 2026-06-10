import { useShallow } from 'zustand/react/shallow'
import { useDeviceStore } from '../stores/device.store'

export interface DeviceStateBundle {
  connected: boolean
  simulationMode: boolean
  isDayMode: boolean | null
  setIsDayMode: (isDay: boolean | null) => void
}

export const useDeviceState = (): DeviceStateBundle =>
  useDeviceStore(
    useShallow((s) => ({
      connected: s.connected,
      simulationMode: s.simulationMode,
      isDayMode: s.isDayMode,
      setIsDayMode: s.setIsDayMode,
    }))
  )
