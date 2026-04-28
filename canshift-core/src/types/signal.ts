// signal.ts — CAN signal mapping configuration types

import type { SemVer } from './common'

/** Individual CAN signal definition */
export interface SignalDef {
  name:        string    // Must match Widget.signal field
  canFrameId:  string    // Hex string e.g. "0x370"
  startByte:   number
  byteLength:  1 | 2 | 4
  bigEndian:   boolean
  signed:      boolean
  bitMask?:    string    // Optional bitmask for flag signals e.g. "0x01"
  scale:       number    // Multiply raw value by this
  offset:      number    // Add this after scaling
  unit:        string
  min:         number
  max:         number
  timeoutMs:   number
}

/** Root signal configuration (signals.json) */
export interface SignalConfig {
  version:       SemVer
  protocol:      string    // e.g. "maxxecu_v1.2"
  canSpeedKbps:  number    // 250, 500, 1000
  signals:       SignalDef[]
}
