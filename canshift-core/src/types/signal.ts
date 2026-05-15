// signal.ts — CAN signal mapping configuration types

import type { HexColor, SemVer } from './common'

/** Single stop on a color ramp — value in the signal's native unit, color in #RRGGBB. */
export interface ColorRampStop {
  value: number
  color: HexColor
}

/**
 * How a `ColorRamp` blends between adjacent stops.
 *  - `linear` — channel-wise lerp between the two surrounding stops.
 *  - `step`   — the lower stop's color is used for the entire segment.
 */
export type RampInterpolation = 'linear' | 'step'

/**
 * Per-signal value→color mapping. Stops MUST be sorted ascending by `value`
 * and contain between 2 and `MAX_RAMP_STOPS` entries. Below the first stop
 * the first color is used; above the last stop the last color is used.
 */
export interface ColorRamp {
  stops: ColorRampStop[]
  interpolate: RampInterpolation
}

/** Individual CAN signal definition */
export interface SignalDef {
  name: string // Must match Widget.signal field
  canFrameId: string // Hex string e.g. "0x370"
  startByte: number
  byteLength: 1 | 2 | 4
  bigEndian: boolean
  signed: boolean
  bitMask?: string // Optional bitmask for flag signals e.g. "0x01"
  scale: number // Multiply raw value by this
  offset: number // Add this after scaling
  unit: string
  min: number
  max: number
  /**
   * Low-side warning threshold. Most signals only need this single side
   * (rpm warns going up, oil pressure warns going down).
   */
  warningLevel?: number
  /** Low-side danger threshold — companion to warningLevel. */
  dangerLevel?: number
  /**
   * High-side warning threshold for signals that alarm in BOTH directions
   * (e.g. battery voltage: warningLevel = under-voltage, highWarningLevel = over-voltage).
   * Firmware reads this from signals.json; absence means no high-side alert.
   */
  highWarningLevel?: number
  /** High-side danger threshold — companion to highWarningLevel. */
  highDangerLevel?: number
  timeoutMs: number
  /**
   * Optional dynamic color ramp (issue #430). When present, widget renderers
   * map the live value through the ramp instead of using static threshold
   * colors. When absent, the firmware falls back to a sensor-name heuristic
   * (see `resolveDefaultRamp`) and finally to the existing static color path.
   */
  colorRamp?: ColorRamp
}

/** Root signal configuration (signals.json) */
export interface SignalConfig {
  version: SemVer
  /**
   * Informational protocol tag — written by exporters, stored by firmware,
   * never used in parsing decisions. Current default is `"custom_v1.0"`;
   * legacy configs with `"maxxecu_v1.2"` are rewritten on load by the
   * 1.13.0 → 1.14.0 migration (issue #639).
   */
  protocol: string
  canSpeedKbps: number // 250, 500, 1000
  signals: SignalDef[]
}
