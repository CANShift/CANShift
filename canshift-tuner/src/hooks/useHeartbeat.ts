import { useEffect } from 'react'
import { useDeviceStore } from '../stores/device.store'
import { useLogStore } from '../stores/log.store'
import { usbService } from '../transport'

const HEARTBEAT_INTERVAL_MS = 5_000
const HEARTBEAT_MISS_THRESHOLD = 3

export const useHeartbeat = (): void => {
  const connected = useDeviceStore((s) => s.connected)
  const transport = useDeviceStore((s) => s.transport)
  const simulationMode = useDeviceStore((s) => s.simulationMode)
  const setFirmwareLiveness = useDeviceStore((s) => s.setFirmwareLiveness)
  const log = useLogStore((s) => s.push)

  useEffect(() => {
    if (!connected || simulationMode || transport !== 'usb') {
      setFirmwareLiveness({ kind: 'unknown' })
      return
    }
    let cancelled = false
    let missed = 0
    let unresponsiveLogged = false
    let firstMissedAt: number | null = null

    const probe = async () => {
      const result = await usbService.ping()
      if (cancelled) return
      if (result.kind === 'ok') {
        missed = 0
        firstMissedAt = null
        unresponsiveLogged = false
        setFirmwareLiveness({
          kind: 'alive',
          lastPongAt: Date.now(),
          uptimeMs: result.uptimeMs,
        })
        return
      }
      missed += 1
      if (firstMissedAt === null) firstMissedAt = Date.now()
      if (missed >= HEARTBEAT_MISS_THRESHOLD) {
        setFirmwareLiveness({
          kind: 'unresponsive',
          missedPings: missed,
          sinceMs: firstMissedAt,
        })
        if (!unresponsiveLogged) {
          log('error', `Firmware unresponsive — ${String(missed)} pings missed (${result.error})`)
          unresponsiveLogged = true
        }
      }
    }

    void probe()
    const id = window.setInterval(() => {
      void probe()
    }, HEARTBEAT_INTERVAL_MS)
    return () => {
      cancelled = true
      window.clearInterval(id)
      setFirmwareLiveness({ kind: 'unknown' })
    }
  }, [connected, simulationMode, transport, setFirmwareLiveness, log])
}
