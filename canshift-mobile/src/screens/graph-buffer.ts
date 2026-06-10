import type { TelemetrySample } from '../stores/telemetry.store'

export const ingestIncremental = (
  rolling: TelemetrySample[],
  freshSamples: readonly TelemetrySample[],
  windowStart: number
): number => {
  if (freshSamples.length > 0) {
    for (const s of freshSamples) rolling.push(s)
  }
  let drop = 0
  while (drop < rolling.length) {
    const head = rolling[drop]
    if (head === undefined || head.t >= windowStart) break
    drop++
  }
  if (drop > 0) rolling.splice(0, drop)
  return drop
}
