const MAX_SAMPLES = 3000

export interface TelemetrySample {
  t: number
  v: Record<string, number>
}

const buffer: (TelemetrySample | undefined)[] = new Array<TelemetrySample | undefined>(MAX_SAMPLES)
let head = 0
let size = 0
let writeIndex = 0

export const pushSample = (values: Record<string, number>): void => {
  buffer[head] = { t: Date.now(), v: { ...values } }
  head = (head + 1) % MAX_SAMPLES
  if (size < MAX_SAMPLES) size++
  writeIndex++
}

export const getWriteIndex = (): number => {
  return writeIndex
}

export const getRange = (fromIndex: number, toIndex: number): readonly TelemetrySample[] => {
  if (toIndex <= fromIndex || size === 0) return []
  const oldestAvailable = writeIndex - size
  const from = Math.max(fromIndex, oldestAvailable)
  const to = Math.min(toIndex, writeIndex)
  if (to <= from) return []
  const count = to - from
  const out: TelemetrySample[] = new Array<TelemetrySample>(count)
  for (let i = 0; i < count; i++) {
    const monotonic = from + i
    const offsetFromHead = writeIndex - monotonic
    const ringIdx = (head - offsetFromHead + MAX_SAMPLES) % MAX_SAMPLES
    const sample = buffer[ringIdx]
    if (sample !== undefined) out[i] = sample
  }
  return out
}

export const clearBuffer = (): void => {
  for (let i = 0; i < MAX_SAMPLES; i++) buffer[i] = undefined
  head = 0
  size = 0
  writeIndex = 0
}
