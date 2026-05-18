// telemetry.store.ts — Mutable ring buffer for time-series signal data
// Not reactive — GraphScreen reads via getWriteIndex() + getRange() on its
// own tick timer (incremental pull, never a full buffer copy).
//
// Implementation note: the buffer uses a circular index instead of Array#shift
// so push is O(1). At ~10 Hz with MAX_SAMPLES = 3000, a naive Array#shift would
// memmove ~3000 entries on every push (~30k ops/s) and was the dominant cause
// of jank on the Dashboard / Graph screens.
//
// Incremental ingestion: getWriteIndex() returns a monotonic counter that
// increments on every push (never wraps). getRange(from, to) returns only
// samples in that index range — consumers track the last index they observed
// and pull just the new samples each tick, avoiding a full buffer copy.

const MAX_SAMPLES = 3000 // ~5 min at 10 Hz

export interface TelemetrySample {
  t: number
  v: Record<string, number>
}

const buffer: (TelemetrySample | undefined)[] = new Array<TelemetrySample | undefined>(MAX_SAMPLES)
let head = 0
let size = 0
let writeIndex = 0 // monotonic — total samples ever pushed since last clear

export function pushSample(values: Record<string, number>): void {
  buffer[head] = { t: Date.now(), v: { ...values } }
  head = (head + 1) % MAX_SAMPLES
  if (size < MAX_SAMPLES) size++
  writeIndex++
}

/**
 * Monotonic write counter — increments on every pushSample(), never wraps,
 * resets to 0 on clearBuffer(). Use with getRange() to incrementally pull
 * only the samples added since the last observed index.
 */
export function getWriteIndex(): number {
  return writeIndex
}

/**
 * Returns samples whose monotonic index falls in [fromIndex, toIndex).
 * Indices older than the retained window are silently dropped (the ring
 * buffer only retains the most recent MAX_SAMPLES). Returned in chronological
 * order. Returns an empty array if the range is empty or invalid.
 */
export function getRange(fromIndex: number, toIndex: number): readonly TelemetrySample[] {
  if (toIndex <= fromIndex || size === 0) return []
  // Clamp to what's actually retained — oldest available index is writeIndex - size.
  const oldestAvailable = writeIndex - size
  const from = Math.max(fromIndex, oldestAvailable)
  const to = Math.min(toIndex, writeIndex)
  if (to <= from) return []
  const count = to - from
  const out: TelemetrySample[] = new Array<TelemetrySample>(count)
  // Map monotonic index to ring position: (head - (writeIndex - i) + MAX) % MAX.
  for (let i = 0; i < count; i++) {
    const monotonic = from + i
    const offsetFromHead = writeIndex - monotonic // 1..size (oldest = size)
    const ringIdx = (head - offsetFromHead + MAX_SAMPLES) % MAX_SAMPLES
    const sample = buffer[ringIdx]
    if (sample !== undefined) out[i] = sample
  }
  return out
}

export function clearBuffer(): void {
  for (let i = 0; i < MAX_SAMPLES; i++) buffer[i] = undefined
  head = 0
  size = 0
  writeIndex = 0
}
