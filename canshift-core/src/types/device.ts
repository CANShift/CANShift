// types/device.ts — Device configuration types.
//
// `CanSpeedKbps` and `CAN_SPEED_OPTIONS` are derived from `CanSpeedKbpsSchema`
// in `../schemas/signal` per issue #778 — schema is the single source of truth.

export type { CanSpeedKbps } from '../schemas/signal.js'
export { CAN_SPEED_OPTIONS } from '../schemas/signal.js'

import type { CanSpeedKbps } from '../schemas/signal.js'

export interface DeviceConfig {
  /** CAN bus speed in kbps — must match ECU output configuration */
  can_speed_kbps: CanSpeedKbps
  /** ESP32 TWAI TX GPIO pin */
  twai_tx_pin: number
  /** ESP32 TWAI RX GPIO pin */
  twai_rx_pin: number
}

export const DEFAULT_DEVICE_CONFIG: DeviceConfig = {
  can_speed_kbps: 500,
  twai_tx_pin: 22,
  twai_rx_pin: 21,
}
