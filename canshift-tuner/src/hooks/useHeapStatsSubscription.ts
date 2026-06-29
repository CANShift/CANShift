import { useEffect } from 'react'
import { useDeviceStore } from '../stores/device.store'
import { deviceEvents } from '../transport'

export const useHeapStatsSubscription = (): void => {
  const connected = useDeviceStore((s) => s.connected)
  const transport = useDeviceStore((s) => s.transport)
  const simulationMode = useDeviceStore((s) => s.simulationMode)
  const pushHeapStats = useDeviceStore((s) => s.pushHeapStats)
  const clearHeapStats = useDeviceStore((s) => s.clearHeapStats)

  useEffect(() => {
    if (!connected || simulationMode || transport !== 'usb') return
    clearHeapStats()
    const unsubscribe = deviceEvents.onHeapStats((entry) => {
      pushHeapStats(entry)
    })
    return unsubscribe
  }, [connected, simulationMode, transport, pushHeapStats, clearHeapStats])
}
