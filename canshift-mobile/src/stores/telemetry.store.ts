// telemetry.store.ts — Mutable ring buffer for time-series signal data
// Not reactive — GraphScreen reads via getBuffer() on its own tick timer.

const MAX_SAMPLES = 3000 // ~5 min at 10 Hz

export interface TelemetrySample {
  t: number
  v: Record<string, number>
}

let buffer: TelemetrySample[] = []

export function pushSample(values: Record<string, number>): void {
  buffer.push({ t: Date.now(), v: { ...values } })
  if (buffer.length > MAX_SAMPLES) buffer.shift()
}

export function getBuffer(): readonly TelemetrySample[] {
  return buffer
}

export function clearBuffer(): void {
  buffer = []
}
