import { z } from 'zod'

import { CanSpeedKbpsSchema } from './signal.js'
import { mapObjectKeys } from '../wire/keymap.js'

const DEVICE_WIRE_TO_DOMAIN = {
  can_speed_kbps: 'canSpeedKbps',
  twai_tx_pin: 'twaiTxPin',
  twai_rx_pin: 'twaiRxPin',
} as const

const DEVICE_DOMAIN_TO_WIRE = {
  canSpeedKbps: 'can_speed_kbps',
  twaiTxPin: 'twai_tx_pin',
  twaiRxPin: 'twai_rx_pin',
} as const

export const SAFE_OUTPUT_PINS_WROOM32 = [
  0, 1, 2, 3, 4, 5, 12, 13, 14, 15, 16, 17, 18, 19, 21, 22, 23, 25, 26, 27, 32, 33,
] as const

export const SAFE_INPUT_PINS_WROOM32 = [
  ...SAFE_OUTPUT_PINS_WROOM32,
  34,
  35,
  36,
  37,
  38,
  39,
] as const

const ESP32_SAFE_OUTPUT_PINS = new Set<number>(SAFE_OUTPUT_PINS_WROOM32)
const ESP32_SAFE_INPUT_PINS = new Set<number>(SAFE_INPUT_PINS_WROOM32)

export const Esp32OutputGpioSchema = z
  .number()
  .int()
  .refine((n) => ESP32_SAFE_OUTPUT_PINS.has(n), {
    message:
      'GPIO must be a safe output pin. Excludes 6-11 (SPI flash — would brick the device), 34-39 (input-only), and unbonded pins.',
  })

export const Esp32InputGpioSchema = z
  .number()
  .int()
  .refine((n) => ESP32_SAFE_INPUT_PINS.has(n), {
    message:
      'GPIO must be a valid ESP32 IO pin. Excludes 6-11 (SPI flash — would brick the device) and unbonded pins (20, 24, 28-31). Input-only pins 34-39 are allowed.',
  })

export const DeviceConfigWireSchema = z
  .object({
    can_speed_kbps: CanSpeedKbpsSchema,
    twai_tx_pin: Esp32OutputGpioSchema,
    twai_rx_pin: Esp32OutputGpioSchema,
  })
  .strict()

export type DeviceConfigWire = z.infer<typeof DeviceConfigWireSchema>

export const DeviceConfigSchema = z
  .object({
    canSpeedKbps: CanSpeedKbpsSchema,
    twaiTxPin: Esp32OutputGpioSchema,
    twaiRxPin: Esp32OutputGpioSchema,
  })
  .strict()

export type DeviceConfig = z.infer<typeof DeviceConfigSchema>

export const DEFAULT_DEVICE_CONFIG: DeviceConfig = {
  canSpeedKbps: 500,
  twaiTxPin: 22,
  twaiRxPin: 21,
}

export const deviceConfigFromWire = (wire: DeviceConfigWire): DeviceConfig =>
  mapObjectKeys(wire, DEVICE_WIRE_TO_DOMAIN) as DeviceConfig

export const deviceConfigToWire = (cfg: DeviceConfig): DeviceConfigWire =>
  mapObjectKeys(cfg, DEVICE_DOMAIN_TO_WIRE) as DeviceConfigWire
