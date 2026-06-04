// useLiveSignals.ts — Live signal values for the diagnostics panel.
//
// Spike port (#1104): identical simulation path to canshift-studio, but the
// connected branch is a no-op subscribe through the transport stub. Phase 3
// re-introduces the real subscription against the dash WS feed.

import { useEffect, useRef, useState } from 'react'
import { useSignalStore } from '../stores/signal.store'
import { useDeviceStore } from '../stores/device.store'
import { deviceEvents } from '../transport'

export function useLiveSignals(): Record<string, number> {
  const signals = useSignalStore((s) => s.signals)
  const connected = useDeviceStore((s) => s.connected)
  const simulationMode = useDeviceStore((s) => s.simulationMode)
  const [values, setValues] = useState<Record<string, number>>({})
  const frameRef = useRef<number | null>(null)
  const startRef = useRef<number>(Date.now())

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
        const period = 8 + (i % 5) * 2
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

  useEffect(() => {
    // Simulation flips `connected: true` alongside `simulationMode: true` — bail
    // here so the live-signal subscriber doesn't overwrite the simulated values
    // with `setValues({})` (R-3).
    if (!connected || simulationMode) return
    setValues({})
    const unsubscribe = deviceEvents.onSignal((payload: unknown) => {
      if (typeof payload === 'object' && payload !== null) {
        const flat: Record<string, number> = {}
        for (const [k, v] of Object.entries(payload as Record<string, unknown>)) {
          if (typeof v === 'number') flat[k] = v
        }
        setValues(flat)
      }
    })
    return unsubscribe
  }, [connected, simulationMode])

  return values
}
