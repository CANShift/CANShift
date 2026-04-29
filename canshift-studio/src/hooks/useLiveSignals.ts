// useLiveSignals.ts — Simulated live signal values for the studio diagnostics panel.
// In simulation mode: generates smooth oscillating values for each configured signal.
// When a real device is connected: TODO — subscribe to USB telemetry stream.

import { useEffect, useRef, useState } from 'react'
import { useSignalStore } from '../stores/signal.store'
import { useDeviceStore } from '../stores/device.store'

export function useLiveSignals(): Record<string, number> {
  const signals = useSignalStore((s) => s.signals)
  const simulationMode = useDeviceStore((s) => s.simulationMode)
  const [values, setValues] = useState<Record<string, number>>({})
  const frameRef = useRef<number | null>(null)
  const startRef = useRef<number>(Date.now())

  useEffect(() => {
    if (!simulationMode || signals.length === 0) {
      setValues({})
      return
    }

    const tick = () => {
      const t = (Date.now() - startRef.current) / 1000
      const next: Record<string, number> = {}
      signals.forEach((sig, i) => {
        const range = sig.max - sig.min
        // Unique phase and period per signal so they don't all move in lockstep
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
  }, [signals, simulationMode])

  return values
}
