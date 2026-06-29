import { useEffect } from 'react'
import { useDeviceStore } from '../stores/device.store'
import { useDashboardStore } from '../stores/dashboard.store'
import { useFlasherStore } from '../stores/flasher.store'
import { DEFAULT_SIM_CONFIG } from '../config/default-sim-config'

export const useSimulationBootstrap = (): void => {
  const connected = useDeviceStore((s) => s.connected)
  const simulationMode = useDeviceStore((s) => s.simulationMode)
  const simulationDismissed = useDeviceStore((s) => s.simulationDismissed)
  const enterSimulation = useDeviceStore((s) => s.enterSimulation)
  const flasherKind = useFlasherStore((s) => s.state.kind)
  const hasConfig = useDashboardStore((s) => s.config !== null)
  const setConfig = useDashboardStore((s) => s.setConfig)

  useEffect(() => {
    if (!import.meta.env.DEV) return
    if (connected || simulationMode || simulationDismissed) return
    if (flasherKind === 'flashing') return
    enterSimulation()
  }, [connected, simulationMode, simulationDismissed, flasherKind, enterSimulation])

  useEffect(() => {
    if (simulationMode && !hasConfig) {
      setConfig(structuredClone(DEFAULT_SIM_CONFIG))
    }
  }, [simulationMode, hasConfig, setConfig])
}
