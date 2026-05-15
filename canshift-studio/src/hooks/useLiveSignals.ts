// useLiveSignals.ts — Live signal values for the studio diagnostics panel.
//
// Simulation mode: generates smooth oscillating values for each configured signal.
// Connected to device: subscribes to USB telemetry pushed by firmware every ~200ms.

import { useEffect, useRef, useState } from 'react'
import { useSignalStore } from '../stores/signal.store'
import { useDeviceStore } from '../stores/device.store'
import { IpcChannels } from '../../shared/ipc-channels'

export function useLiveSignals(): Record<string, number> {
  const signals = useSignalStore((s) => s.signals)
  const connected = useDeviceStore((s) => s.connected)
  const simulationMode = useDeviceStore((s) => s.simulationMode)
  const [values, setValues] = useState<Record<string, number>>({})
  const frameRef = useRef<number | null>(null)
  const startRef = useRef<number>(Date.now())

  // ---------------------------------------------------------------------------
  // Simulation mode — rAF-driven oscillating values
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (connected || !simulationMode || signals.length === 0) {
      setValues({})
      return
    }

    startRef.current = Date.now()

    const tick = () => {
      const t = (Date.now() - startRef.current) / 1000
      const next: Record<string, number> = {}
      signals.forEach((sig, i) => {
        const range = sig.max - sig.min
        const phase = (i * 1.3) % (2 * Math.PI)
        const period = 8 + (i % 5) * 2 // 8–16 s cycle
        const pct = (Math.sin((t * 2 * Math.PI) / period + phase) + 1) / 2
        next[sig.name] = sig.min + pct * range
      })
      setValues(next)
      frameRef.current = requestAnimationFrame(tick)
    }

    frameRef.current = requestAnimationFrame(tick)
    return () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current)
    }
  }, [signals, simulationMode, connected])

  // ---------------------------------------------------------------------------
  // Device connected — subscribe to USB telemetry events from the main process
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!connected) return

    setValues({})

    const listener = (payload: unknown) => {
      if (typeof payload === 'object' && payload !== null) {
        const flat: Record<string, number> = {}
        for (const [k, v] of Object.entries(payload as Record<string, unknown>)) {
          if (typeof v === 'number') flat[k] = v
        }
        setValues(flat)
      }
    }

    window.ipc.on(IpcChannels.USB_DATA_RECEIVED, listener)
    return () => {
      window.ipc.off(IpcChannels.USB_DATA_RECEIVED, listener)
    }
  }, [connected])

  return values
}
