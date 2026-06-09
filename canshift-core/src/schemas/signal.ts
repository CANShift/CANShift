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
import { Obd2PollingSchema } from './obd2.js'
import { SignalTypeSchema } from './signal-type.js'
import {
  CAN_29BIT_MAX,
  CAN_FRAME_MAX_BYTES,
  FIRMWARE_CAPS,
  MAX_RAMP_STOPS,
  STRING_CAPS,
} from '../constants/firmware-caps.js'

const CAN_FRAME_ID_REGEX = /^0[xX][0-9a-fA-F]{1,8}$/

/** Optional bit mask — any-length hex literal, e.g. "0x01", "0xFF00". */
const BIT_MASK_REGEX = /^0[xX][0-9a-fA-F]+$/

/**
 * Outbound CAN frame identifier — hex literal up to 8 hex chars to span both
 * the 11-bit standard (≤ 0x7FF) and the 29-bit extended (≤ 0x1FFFFFFF) ranges.
 * The exact 29-bit bound is enforced numerically below; this regex only gates
 * the wire form (`"0x600"`, `"0X1FFFFFFF"`).
 */
const OUTBOUND_FRAME_ID_REGEX = /^0[xX][0-9a-fA-F]{1,8}$/

/** Single stop on a color ramp — value in the signal's native unit, color in #RRGGBB. */
export const ColorRampStopSchema = z
  .object({
    // Optional stable id — used by Studio's ColorRampEditor to key reorderable
    // rows so DOM state (focused input, IME) doesn't shift when a stop is
    // removed (R-5, issue #1288). Editors generate one at creation; absent on
    // configs authored before this field existed.
    id: z.string().min(1).optional(),
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

/**
 * Individual CAN signal definition.
 *
 * # Threshold-zone contract (issue #1036)
 *
 * A signal can carry up to four threshold levels that partition `[min, max]`
 * into "safe / warning / danger" bands. There are three valid topologies:
 *
 * ## High-side only (e.g. coolant temp, IAT)
 * ```
 *   min                  warningLevel        dangerLevel       max
 *   |--------- safe ---------|---- warning ---|---- danger ----|
 * ```
 * Set `warningLevel <= dangerLevel`. Leave the `high*` pair undefined.
 *
 * ## Low-side only (e.g. oil pressure, fuel pressure)
 * ```
 *   min       dangerLevel       warningLevel              max
 *   |- danger -|---- warning ----|---------- safe ----------|
 * ```
 * Set `dangerLevel <= warningLevel`. Leave the `high*` pair undefined.
 *
 * ## Two-sided (e.g. battery voltage: undervolt + overcharge)
 * ```
 *   min  danger  warning           highWarning  highDanger  max
 *   |-D----|--W---|------ safe -----|----W------|----D------|
 *           ↑                       ↑
 *      low-side                 high-side
 * ```
 * Set all four. The low-side primary pair (`dangerLevel`, `warningLevel`)
 * must sit STRICTLY below the high-side pair (`highWarningLevel`,
 * `highDangerLevel`) — see invariants below.
 *
 * # Enforced invariants (validator)
 *
 * 1. Each defined level lies within `[min, max]`.
 * 2. Primary pair is monotonic: `warningLevel <= dangerLevel` (high-side) OR
 *    `dangerLevel <= warningLevel` (low-side). Equal values pass — degenerate
 *    but unambiguous.
 * 3. High-side dual pair: `highWarningLevel <= highDangerLevel`.
 * 4. Two-sided (all four present, primary detected as low-side): the low-side
 *    `warningLevel` must be `< highWarningLevel`. Equality is rejected to
 *    keep the safe-zone gap non-empty.
 *
 * # NOT enforced (caller's responsibility)
 *
 * - **Two-sided with a high-side primary pair** (`warningLevel < dangerLevel`
 *   plus both `high*` set) is accepted by the schema today even though it is
 *   semantically incoherent (two overlapping high-side ramps). Such configs
 *   have not appeared in the wild; reject in a follow-up if they do.
 * - **Inclusive vs exclusive boundary semantics at thresholds** are decided
 *   by the consumer (firmware `SignalDef` ramp logic, studio preview, mobile
 *   readout). The schema accepts any numeric value; renderers treat a sample
 *   `v == warningLevel` as "in warning" by convention.
 * - **Gap width between low-side `warningLevel` and `highWarningLevel`** is
 *   only required to be non-zero (invariant 4). A 0.1-unit gap passes
 *   validation; whether that is meaningful for a given signal is a config
 *   choice, not a schema invariant.
 */
export const SignalDefSchema = z
  .object({
    // Optional per-signal JSON-side documentation field — the firmware demo
    // sprinkles `_comment` lines through `signals[]` to mark frame boundaries
    // (#1289). Matches the same field allowed at the root of `SignalConfig`.
    _comment: z.string().optional(),
    // Optional per-signal JSON-side documentation field — the firmware demo
    // attaches a `_batteryThresholds` note to the `battery_volts` signal to
    // explain the low/high-side threshold tuning (#1303). The firmware reader
    // (`config_loader.cpp`) ignores it; only the typed `warningLevel` /
    // `dangerLevel` / `highWarningLevel` / `highDangerLevel` fields drive the
    // ramp. Modeled as a string to match the actual demo payload.
    _batteryThresholds: z.string().optional(),
    name: z.string().max(STRING_CAPS.SIGNAL_NAME),
    canFrameId: z
      .string()
      .regex(CAN_FRAME_ID_REGEX, 'canFrameId must be hex like 0x123 (1-3 hex chars)'),
    startByte: z
      .number()
      .int()
      .min(0)
      .max(CAN_FRAME_MAX_BYTES - 1),
    byteLength: z.union([z.literal(1), z.literal(2), z.literal(4)]),
    bigEndian: z.boolean(),
    signed: z.boolean(),
    bitMask: z.string().regex(BIT_MASK_REGEX, 'bitMask must be a hex literal like 0xFF').optional(),
    scale: z.number().finite(),
    offset: z.number().finite(),
    unit: z.string().max(STRING_CAPS.SIGNAL_UNIT),
    min: z.number(),
    max: z.number(),
    warningLevel: z.number().optional(),
    dangerLevel: z.number().optional(),
    highWarningLevel: z.number().optional(),
    highDangerLevel: z.number().optional(),
    timeoutMs: z.number(),
    // Semantic kind of value this signal carries. Drives the palette every
    // widget bound to it uses for zone fills, value tinting and danger
    // flash. Optional for backward compatibility — pre-`type` configs
    // resolve to `DEFAULT_SIGNAL_TYPE` ("generic") and widgets fall back
    // to their hand-picked `style.primaryColor`.
    type: SignalTypeSchema.optional(),
    colorRamp: ColorRampSchema.optional(),
    // Issue #841 — when present, switches this signal from passive broadcast
    // decoding (`canFrameId` is the frame the ECU sends unsolicited) to
    // request/response polling. The firmware Obd2Poller sends a query at
    // `intervalMs` and decodes the response into this signal. Absent =
    // legacy broadcast behaviour. v1 supports Mode 01 + single ECU only.
    polling: Obd2PollingSchema.optional(),
  })
  .strict()
  .refine((s) => s.min < s.max, {
    message: 'min must be less than max',
    path: ['min'],
  })
  // Issue #1010 — relational invariants on threshold fields.
  //
  // The primary `(warningLevel, dangerLevel)` pair can describe either a
  // high-side ramp (warn rises to danger, e.g. coolant temp: 100 → 115 °C)
  // or a low-side ramp (warn drops to danger, e.g. oil pressure or battery
  // undervolt: 1.5 → 1.0 bar, 12.0 → 11.5 V). Both orderings are valid; the
  // firmware ramp logic (`config_types.h` SignalDef) treats `warningLevel`
  // as the outer bound and `dangerLevel` as the inner one regardless of
  // direction. The optional `(highWarningLevel, highDangerLevel)` pair is
  // unambiguously high-side and exists alongside the low-side primary pair
  // for two-sided signals (battery: undervolt + overcharge).
  .superRefine((s, ctx) => {
    const levelKeys: ('warningLevel' | 'dangerLevel' | 'highWarningLevel' | 'highDangerLevel')[] = [
      'warningLevel',
      'dangerLevel',
      'highWarningLevel',
      'highDangerLevel',
    ]
    for (const key of levelKeys) {
      const v = s[key]
      if (v === undefined) continue
      if (v < s.min || v > s.max) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `${key} (${v.toString()}) must be within [min=${s.min.toString()}, max=${s.max.toString()}]`,
          path: [key],
        })
      }
    }

    // Primary pair must form a monotonic ramp (either direction).
    if (s.warningLevel !== undefined && s.dangerLevel !== undefined) {
      const highSideOk = s.warningLevel <= s.dangerLevel
      const lowSideOk = s.dangerLevel <= s.warningLevel
      if (!highSideOk && !lowSideOk) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            'warningLevel/dangerLevel must form a monotonic ramp: ' +
            'high-side requires warningLevel <= dangerLevel, ' +
            'low-side requires dangerLevel <= warningLevel',
          path: ['dangerLevel'],
        })
      }
    }

    // High-side dual pair is unambiguous: warning must precede danger.
    if (
      s.highWarningLevel !== undefined &&
      s.highDangerLevel !== undefined &&
      s.highWarningLevel > s.highDangerLevel
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'highWarningLevel must be <= highDangerLevel (high-side ramp)',
        path: ['highDangerLevel'],
      })
    }

    // Two-sided signals (battery: low-side primary + high-side overcharge):
    // the low-side pair must sit strictly below the high-side pair so the
    // zones don't overlap. Detected by the presence of all four levels and
    // a low-side ordering on the primary pair (dangerLevel <= warningLevel).
    if (
      s.warningLevel !== undefined &&
      s.dangerLevel !== undefined &&
      s.highWarningLevel !== undefined &&
      s.highDangerLevel !== undefined &&
      s.dangerLevel <= s.warningLevel &&
      s.warningLevel >= s.highWarningLevel
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'low-side warningLevel must be below highWarningLevel',
        path: ['highWarningLevel'],
      })
    }
  })

/**
 * CAN bus speed in kbps — single source of truth (issue #778).
 * Firmware's `getTimingConfig` accepts 250/500/1000 and falls back for 125,
 * but core keeps 125 in the enum for parity with the firmware fallback path.
 * The `CanSpeedKbps` type and `CAN_SPEED_OPTIONS` array are derived below;
 * adding a new speed here automatically propagates to both.
 */
export const CanSpeedKbpsSchema = z.union([
  z.literal(125),
  z.literal(250),
  z.literal(500),
  z.literal(1000),
])

/** Allowed CAN bus speeds in kbps — derived from `CanSpeedKbpsSchema`. */
export type CanSpeedKbps = z.infer<typeof CanSpeedKbpsSchema>

/** Ordered list of allowed CAN bus speeds — derived from `CanSpeedKbpsSchema`. */
export const CAN_SPEED_OPTIONS: readonly CanSpeedKbps[] = CanSpeedKbpsSchema.options.map(
  (o) => o.value
)

/**
 * Outbound CAN frame override (#317, #1303). The firmware ships a baked
 * default frame ID for each outbound frame (e.g. `CAN_OUT_MAP_SWITCH_ID =
 * 0x600` in `include/can_signals_out.h`); the `out` block of `signals.json`
 * lets the user override it at runtime. `config_loader.cpp` parses each entry
 * via:
 *   - `id`        — hex string (`"0x600"`); numeric IDs are also accepted by
 *                   firmware but the wire form is the hex literal.
 *   - `extended`  — optional boolean; auto-set when `id > 0x7FF`.
 *   - `encoding`  — free-form documentation string the firmware ignores.
 *
 * Keys are snake_case on the wire (e.g. `map_switch`) per the cross-package
 * convention.
 */
export const OutboundCanSignalSchema = z
  .object({
    id: z
      .string()
      .regex(OUTBOUND_FRAME_ID_REGEX, 'id must be a hex literal like 0x600 (up to 8 hex chars)')
      .refine(
        (s) => Number.parseInt(s, 16) <= CAN_29BIT_MAX,
        `id must fit in 29 bits (≤ 0x${CAN_29BIT_MAX.toString(16).toUpperCase()})`
      ),
    extended: z.boolean().optional(),
    // Free-form documentation the firmware reader ignores. Kept typed so the
    // demo `signals.json` validates clean without `.passthrough()`.
    encoding: z.string().optional(),
  })
  .strict()

/**
 * Root signal configuration (signals.json). `protocol` is informational only —
 * never used in parsing decisions. Current default is `"custom_v1.0"`.
 */
export const SignalConfigSchema = z
  .object({
    // Optional JSON-side documentation fields the firmware demo ships with
    // (`_comment`, `_warning`, `_outboundWarning`). Mirrors the `_comment`
    // already accepted on `DashboardConfigSchema` so `validateSignalConfig`
    // doesn't reject the firmware's own `signals.json` (#1289).
    _comment: z.string().optional(),
    _warning: z.string().optional(),
    _outboundWarning: z.string().optional(),
    version: SemVerSchema,
    protocol: z.string().max(STRING_CAPS.PROTOCOL),
    canSpeedKbps: CanSpeedKbpsSchema,
    // Outbound CAN frame ID overrides (#317, #1303). Keys are snake_case
    // frame names the firmware recognises (`map_switch` today); values are
    // `OutboundCanSignal` shapes. Optional — missing keys leave the
    // compiled-in default in `include/can_signals_out.h` untouched.
    out: z.record(z.string(), OutboundCanSignalSchema).optional(),
    // Firmware allocates a fixed-size signal array — over-limit catalogs would
    // silently drop tail signals at load time. Mirrors the `actions` /
    // `inputBindings` caps already enforced elsewhere (#1168).
    signals: z
      .array(SignalDefSchema)
      .max(
        FIRMWARE_CAPS.MAX_SIGNALS,
        `signals cannot exceed ${String(FIRMWARE_CAPS.MAX_SIGNALS)} entries (firmware cap)`
      ),
  })
  .strict()

export type ColorRampStop = z.infer<typeof ColorRampStopSchema>
export type RampInterpolation = z.infer<typeof RampInterpolationSchema>
export type ColorRamp = z.infer<typeof ColorRampSchema>
export type SignalDef = z.infer<typeof SignalDefSchema>
export type OutboundCanSignal = z.infer<typeof OutboundCanSignalSchema>
export type SignalConfig = z.infer<typeof SignalConfigSchema>
