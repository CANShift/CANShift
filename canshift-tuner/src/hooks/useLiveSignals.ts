import { useEffect, useRef, useState } from 'react'
import { useSignalStore } from '../stores/signal.store'
import { useDeviceStore } from '../stores/device.store'
import { deviceEvents } from '../transport'

export const useLiveSignals = (): Record<string, number> => {
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
