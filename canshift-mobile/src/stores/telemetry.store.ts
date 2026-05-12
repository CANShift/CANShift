// telemetry.store.ts — Mutable ring buffer for time-series signal data
// Not reactive — GraphScreen reads via getBuffer() on its own tick timer.
//
// Implementation note: the buffer uses a circular index instead of Array#shift
// so push is O(1). At ~10 Hz with MAX_SAMPLES = 3000, a naive Array#shift would
// memmove ~3000 entries on every push (~30k ops/s) and was the dominant cause
// of jank on the Dashboard / Graph screens.

const MAX_SAMPLES = 3000 // ~5 min at 10 Hz

export interface TelemetrySample {
  t: number
  v: Record<string, number>
}

const buffer: (TelemetrySample | undefined)[] = new Array<TelemetrySample | undefined>(MAX_SAMPLES)
let head = 0
let size = 0

export function pushSample(values: Record<string, number>): void {
  buffer[head] = { t: Date.now(), v: { ...values } }
  head = (head + 1) % MAX_SAMPLES
  if (size < MAX_SAMPLES) size++
}

/**
 * Returns samples in chronological (oldest → newest) order. The returned
 * array is a fresh snapshot; mutating it does not affect the ring buffer.
 */
export function getBuffer(): readonly TelemetrySample[] {
  if (size === 0) return []
  const out: TelemetrySample[] = new Array<TelemetrySample>(size)
  // Oldest entry is at (head - size + MAX_SAMPLES) % MAX_SAMPLES.
  const start = (head - size + MAX_SAMPLES) % MAX_SAMPLES
  for (let i = 0; i < size; i++) {
    const sample = buffer[(start + i) % MAX_SAMPLES]
    if (sample !== undefined) out[i] = sample
  }
  return out
}

export function clearBuffer(): void {
  for (let i = 0; i < MAX_SAMPLES; i++) buffer[i] = undefined
  head = 0
  size = 0
}
