// schemas/track-telemetry.ts — Zod schema for the Track-mode BLE telemetry
// message produced by canshift-mobile and consumed by canshift-firmware.
// Issue #843 (sub-issue of #815).
//
// The schema is the **contract** between the mobile GPS lap-timing engine
// and the firmware TRACK indicator / lap-time overlay. Both ends import it
// from canshift-core verbatim — never duplicate it. Strict mode rejects
// unknown keys so a future mobile version can't slip undeclared payload
// fields past an older firmware build.
//
// Field semantics:
//   - `trackMode`         True while the mobile app is recording on a circuit.
//   - `currentLapMs`      Elapsed time of the in-progress lap, monotonically
//                         increasing from 0 at each start-finish crossing.
//   - `lastLapMs`         Time of the most recently completed lap.
//   - `bestLapMs`         Personal best within the current session.
//   - `lapNumber`         1-indexed lap counter (0 = warm-up, no S/F crossing yet).
//   - `deltaMs`           Signed delta against `bestLapMs`. Positive = slower
//                         than best; negative = ahead. Updated continuously
//                         while a lap is in progress.
//   - `isBestLap`         Pulse flag — mobile sets it true for the single
//                         frame where a new best was just clocked. Firmware
//                         can use it to trigger a one-shot animation.

import { z } from 'zod'

// ---------------------------------------------------------------------------
// Bounds — tuned for sane circuit times (≤ 1 hour) and a max lap counter that
// fits in an LVGL label without overflow. Updating these does not break the
// wire format; just relaxes the validator.
// ---------------------------------------------------------------------------

/** Hard cap on any single lap duration. Anything longer is almost certainly
 *  a stale or corrupted reading from the GPS pipeline. */
const LAP_MAX_MS = 60 * 60 * 1000

/** Cap on the lap counter shown to the firmware. Sessions longer than this
 *  on a real circuit are vanishingly rare — and protect the display from
 *  overflowing the integer-render path. */
const LAP_NUMBER_MAX = 9999

/** Cap on the signed delta. ±1 hour is more than enough headroom; anything
 *  larger indicates a mismatched best-lap baseline. */
const DELTA_ABS_MAX_MS = 60 * 60 * 1000

const LapTimeMsSchema = z
  .number()
  .int('lap times must be whole milliseconds')
  .nonnegative('lap times cannot be negative')
  .max(LAP_MAX_MS, `lap times cannot exceed ${String(LAP_MAX_MS)} ms (1 h)`)

const LapNumberSchema = z
  .number()
  .int()
  .min(0)
  .max(LAP_NUMBER_MAX, `lap number cannot exceed ${String(LAP_NUMBER_MAX)}`)

const DeltaMsSchema = z
  .number()
  .int('delta must be whole milliseconds')
  .min(-DELTA_ABS_MAX_MS, `delta cannot be below ${String(-DELTA_ABS_MAX_MS)} ms`)
  .max(DELTA_ABS_MAX_MS, `delta cannot exceed ${String(DELTA_ABS_MAX_MS)} ms`)

export const TrackTelemetrySchema = z
  .object({
    trackMode: z.boolean(),
    currentLapMs: LapTimeMsSchema.optional(),
    lastLapMs: LapTimeMsSchema.optional(),
    bestLapMs: LapTimeMsSchema.optional(),
    lapNumber: LapNumberSchema.optional(),
    deltaMs: DeltaMsSchema.optional(),
    isBestLap: z.boolean().optional(),
  })
  .strict()

export type TrackTelemetry = z.infer<typeof TrackTelemetrySchema>
