// signal.ts — CAN signal mapping configuration types

import type { SemVer } from './common'

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
}

/** Root signal configuration (signals.json) */
export interface SignalConfig {
  version: SemVer
  protocol: string // e.g. "maxxecu_v1.2"
  canSpeedKbps: number // 250, 500, 1000
  signals: SignalDef[]
}
