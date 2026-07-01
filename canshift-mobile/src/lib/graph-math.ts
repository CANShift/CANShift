import type { TelemetrySample } from '../stores/telemetry.store'
import { SIGNAL_META, type SignalKey } from '../constants/ble'

export const SIGNAL_RANGE: Record<SignalKey, { min: number; max: number }> = {
  r: { min: 0, max: 8000 },
  tps: { min: 0, max: 100 },
  map: { min: 0, max: 300 },
  mi: { min: 0, max: 8 },
  bst: { min: -0.5, max: 2.5 },
  iat: { min: -20, max: 80 },
  ct: { min: 20, max: 130 },
  ot: { min: 20, max: 150 },
  op: { min: 0, max: 10 },
  fp: { min: 0, max: 10 },
  lam: { min: 0.6, max: 1.4 },
  s: { min: 0, max: 250 },
  g: { min: 0, max: 6 },
  bat: { min: 10, max: 16 },
}

export const buildPoints = (
  buffer: readonly TelemetrySample[],
  key: SignalKey,
  windowStart: number,
  windowEnd: number,
  w: number,
  h: number
): string => {
  const range = SIGNAL_RANGE[key]
  const span = windowEnd - windowStart
  const valueSpan = range.max - range.min
  const pts: string[] = []
  for (const s of buffer) {
    if (s.t < windowStart) continue
    const value = s.v[key]
    if (value === undefined || !Number.isFinite(value)) continue
    const x = ((s.t - windowStart) / span) * w
    const norm = Math.max(0, Math.min(1, (value - range.min) / valueSpan))
    pts.push(`${x.toFixed(1)},${((1 - norm) * h).toFixed(1)}`)
  }
  return pts.join(' ')
}

export const formatTime = (ms: number): string => {
  const d = new Date(ms)
  return d.toLocaleTimeString('en-US', { hour12: false })
}

export const formatValue = (key: SignalKey, val: number | undefined): string => {
  if (val === undefined) return '—'
  const meta = SIGNAL_META[key]
  return meta.decimals === 0
    ? `${String(Math.round(val))}${meta.unit}`
    : `${val.toFixed(meta.decimals)}${meta.unit}`
}
