// types/device.ts — Device configuration types.
//
// `CanSpeedKbps` and `CAN_SPEED_OPTIONS` are derived from `CanSpeedKbpsSchema`
// in `../schemas/signal` per issue #778. `DeviceConfig` is derived from
// `DeviceConfigSchema` in `../schemas/device` per issue #789. Schemas are
// the single source of truth.

import type { DeviceConfig } from '../schemas/device.js'

export type { CanSpeedKbps } from '../schemas/signal.js'
export { CAN_SPEED_OPTIONS } from '../schemas/signal.js'
export type { DeviceConfig } from '../schemas/device.js'

export const DEFAULT_DEVICE_CONFIG: DeviceConfig = {
  can_speed_kbps: 500,
  twai_tx_pin: 22,
  twai_rx_pin: 21,
}
