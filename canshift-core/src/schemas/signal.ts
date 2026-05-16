// schemas/signal.ts — Zod schemas for the signal catalog.
//
// Mirrors `types/signal.ts` field-for-field. `SignalConfig`, `SignalDef`,
// `ColorRamp`, `ColorRampStop`, and `RampInterpolation` are now derived from
// these schemas via `z.infer`.
//
// Issue #701 — schema enforces SignalDef invariants previously only checked
// ad-hoc in consumers: hex `canFrameId`, `byteLength` enum, `min < max`,
// optional hex `bitMask`, and the `canSpeedKbps` enum (matches firmware's
// `getTimingConfig` switch in `can_manager.cpp` plus the legacy 125 kbps slot
// kept for parity with `types/device.ts::CAN_SPEED_OPTIONS`).

import { z } from 'zod'

import { HexColorSchema, SemVerSchema } from './common.js'
import { MAX_RAMP_STOPS } from '../constants/firmware-caps.js'

/** CAN frame identifier — 11-bit standard hex literal, e.g. "0x123" or "0X7FF". */
const CAN_FRAME_ID_REGEX = /^0[xX][0-9a-fA-F]{1,3}$/

/** Optional bit mask — any-length hex literal, e.g. "0x01", "0xFF00". */
const BIT_MASK_REGEX = /^0[xX][0-9a-fA-F]+$/

/** Single stop on a color ramp — value in the signal's native unit, color in #RRGGBB. */
export const ColorRampStopSchema = z
  .object({
    value: z.number(),
    color: HexColorSchema,
  })
  .strict()

/**
 * How a `ColorRamp` blends between adjacent stops.
 *  - `linear` — channel-wise lerp between the two surrounding stops.
 *  - `step`   — the lower stop's color is used for the entire segment.
 */
export const RampInterpolationSchema = z.enum(['linear', 'step'])

/**
 * Per-signal value→color mapping. Stops are sorted ascending by `value` and
 * contain between 2 and `MAX_RAMP_STOPS` entries (the firmware-side cap, #700).
 */
export const ColorRampSchema = z
  .object({
    stops: z
      .array(ColorRampStopSchema)
      .min(2, 'colorRamp.stops must contain at least 2 stops')
      .max(
        MAX_RAMP_STOPS,
        `colorRamp.stops cannot exceed ${MAX_RAMP_STOPS.toString()} entries (firmware cap)`
      )
      .refine(
        (stops) =>
          stops.every((stop, idx) => {
            if (idx === 0) return true
            const prev = stops[idx - 1]
            return prev !== undefined && prev.value < stop.value
          }),
        { message: 'colorRamp.stops must be sorted strictly ascending by value' }
      ),
    interpolate: RampInterpolationSchema,
  })
  .strict()

/** Individual CAN signal definition. */
export const SignalDefSchema = z
  .object({
    name: z.string(),
    canFrameId: z
      .string()
      .regex(CAN_FRAME_ID_REGEX, 'canFrameId must be hex like 0x123 (1-3 hex chars)'),
    startByte: z.number(),
    byteLength: z.union([z.literal(1), z.literal(2), z.literal(4)]),
    bigEndian: z.boolean(),
    signed: z.boolean(),
    bitMask: z.string().regex(BIT_MASK_REGEX, 'bitMask must be a hex literal like 0xFF').optional(),
    scale: z.number(),
    offset: z.number(),
    unit: z.string(),
    min: z.number(),
    max: z.number(),
    warningLevel: z.number().optional(),
    dangerLevel: z.number().optional(),
    highWarningLevel: z.number().optional(),
    highDangerLevel: z.number().optional(),
    timeoutMs: z.number(),
    colorRamp: ColorRampSchema.optional(),
  })
  .strict()
  .refine((s) => s.min < s.max, {
    message: 'min must be less than max',
    path: ['min'],
  })

/**
 * CAN bus speed in kbps. Matches `types/device.ts::CAN_SPEED_OPTIONS` —
 * firmware's `getTimingConfig` accepts 250/500/1000 and falls back for 125,
 * but core keeps 125 in the enum for parity with `CanSpeedKbps`.
 */
export const CanSpeedKbpsSchema = z.union([
  z.literal(125),
  z.literal(250),
  z.literal(500),
  z.literal(1000),
])

/**
 * Root signal configuration (signals.json). `protocol` is informational only —
 * never used in parsing decisions. Current default is `"custom_v1.0"`.
 */
export const SignalConfigSchema = z
  .object({
    version: SemVerSchema,
    protocol: z.string(),
    canSpeedKbps: CanSpeedKbpsSchema,
    signals: z.array(SignalDefSchema),
  })
  .strict()

export type ColorRampStop = z.infer<typeof ColorRampStopSchema>
export type RampInterpolation = z.infer<typeof RampInterpolationSchema>
export type ColorRamp = z.infer<typeof ColorRampSchema>
export type SignalDef = z.infer<typeof SignalDefSchema>
export type SignalConfig = z.infer<typeof SignalConfigSchema>
