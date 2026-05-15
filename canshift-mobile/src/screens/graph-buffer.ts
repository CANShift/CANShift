// graph-buffer.ts — Pure helper for the GraphScreen rolling chart buffer.
// Extracted from GraphScreen.tsx so it can be unit-tested without dragging
// in React Native, react-native-ble-plx, etc. (closes #684)

import type { TelemetrySample } from '../stores/telemetry.store'

/**
 * Maintains a stable rolling buffer for the chart. Mutates `rolling` in place:
 * appends `freshSamples`, then drops head entries older than `windowStart`.
 * Returns the number of head entries dropped (for tests / diagnostics).
 *
 * Callers must pass `freshSamples` in chronological order (oldest → newest)
 * and ensure `rolling`'s existing entries are also chronological — the trim
 * pass only walks the head prefix.
 */
export function ingestIncremental(
  rolling: TelemetrySample[],
  freshSamples: readonly TelemetrySample[],
  windowStart: number
): number {
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
