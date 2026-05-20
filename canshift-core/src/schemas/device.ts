// schemas/device.ts — Zod schemas for the on-device hardware config.
//
// Two strict schemas live here:
//   - `DeviceConfigSchema` (camelCase) — the in-process TS domain shape used
//     by studio renderer/main, mobile, and any future JS consumer.
//   - `DeviceConfigWireSchema` (snake_case) — the on-disk JSON wire format
//     read verbatim by canshift-firmware (`config_loader.cpp` reads
//     `doc["can_speed_kbps"]`, `doc["twai_tx_pin"]`, `doc["twai_rx_pin"]`
//     from `userData/device.json`). Used only at IO/IPC boundaries.
//
// `deviceConfigFromWire` / `deviceConfigToWire` are the single source of truth
// for the snake↔camel conversion. Domain code never sees the wire shape —
// callers parse with the wire schema, map to domain, do their work, then map
// back to wire before persisting. Issue #715.
//
// `CanSpeedKbpsSchema` lives in `./signal.js` (single source of truth per
// #778).
//
// Issue #831 — chip-level GPIO safety. Pins 6-11 are wired to the internal
// SPI flash on the ESP32-WROOM-32 — writing to them at runtime corrupts
// flash and bricks the device. Pins 34-39 are input-only (no output driver)
// so they can't drive TWAI TX. The `Esp32OutputGpioSchema` enforces both,
// with an error message that tells the user WHY.

import { z } from 'zod'

import { CanSpeedKbpsSchema } from './signal.js'

/**
 * ESP32 pins safe to use as OUTPUTS. Excludes:
 *  - 6-11: connected to internal SPI flash — writing bricks the device.
 *  - 34-39: input-only pins (no output driver).
 *  - 20, 24, 28, 29, 30, 31: not bonded out on most ESP32 packages.
 */
const ESP32_SAFE_OUTPUT_PINS = new Set<number>([
  0, 1, 2, 3, 4, 5, 12, 13, 14, 15, 16, 17, 18, 19, 21, 22, 23, 25, 26, 27, 32, 33,
])

/**
 * ESP32 pins safe to use as INPUTS. Superset of output-safe — includes 34-39
 * (input-only pins).
 */
const ESP32_SAFE_INPUT_PINS = new Set<number>([...ESP32_SAFE_OUTPUT_PINS, 34, 35, 36, 37, 38, 39])

/**
 * ESP32 GPIO usable as an OUTPUT pin. Rejects flash-SPI (6-11), input-only
 * (34-39), and unbonded pins. Used for `twai_tx_pin` AND `twai_rx_pin` —
 * the TWAI peripheral is logically bi-directional and choosing the
 * stricter "must be output-capable" superset for both pins keeps the rule
 * simple to reason about (and matches firmware-side guidance in
 * `board_config.h:76-77`).
 */
export const Esp32OutputGpioSchema = z
  .number()
  .int()
  .refine((n) => ESP32_SAFE_OUTPUT_PINS.has(n), {
    message:
      'GPIO must be a safe output pin. Excludes 6-11 (SPI flash — would brick the device), 34-39 (input-only), and unbonded pins.',
  })

/**
 * ESP32 GPIO usable as an INPUT pin. Allows 34-39 (input-only) in addition
 * to the output-safe set. Not currently used by `DeviceConfigSchema` but
 * exported for downstream consumers that need to validate input-only pin
 * assignments (touch IRQ, dedicated sensor inputs, …).
 */
export const Esp32InputGpioSchema = z
  .number()
  .int()
  .refine((n) => ESP32_SAFE_INPUT_PINS.has(n), {
    message: 'GPIO must be a valid ESP32 IO pin. Excludes 6-11 (SPI flash) and unbonded pins.',
  })

/**
 * On-disk wire format of `userData/device.json`. Strict — extra fields are
 * rejected so a stale studio payload can't smuggle unknown keys through the
 * IPC boundary into the file on disk. Field names mirror the firmware JSON
 * keys verbatim and MUST NOT change without a coordinated firmware update.
 */
export const DeviceConfigWireSchema = z
  .object({
    /** CAN bus speed in kbps — must match ECU output configuration */
    can_speed_kbps: CanSpeedKbpsSchema,
    /** ESP32 TWAI TX GPIO pin — must be output-capable */
    twai_tx_pin: Esp32OutputGpioSchema,
    /** ESP32 TWAI RX GPIO pin — kept on the output-safe set for simplicity */
    twai_rx_pin: Esp32OutputGpioSchema,
  })
  .strict()

export type DeviceConfigWire = z.infer<typeof DeviceConfigWireSchema>

/**
 * In-process domain shape of the ESP32 hardware config. CamelCase to match
 * every other core domain type (issue #715). Strict — rejects unknown keys.
 * Use `deviceConfigFromWire` / `deviceConfigToWire` at file/IPC boundaries.
 */
export const DeviceConfigSchema = z
  .object({
    /** CAN bus speed in kbps — must match ECU output configuration */
    canSpeedKbps: CanSpeedKbpsSchema,
    /** ESP32 TWAI TX GPIO pin */
    twaiTxPin: Esp32OutputGpioSchema,
    /** ESP32 TWAI RX GPIO pin — kept on the output-safe set for simplicity */
    twaiRxPin: Esp32OutputGpioSchema,
  })
  .strict()

export type DeviceConfig = z.infer<typeof DeviceConfigSchema>

/** Default device config — sane pins for the CrowPanel 2.8" reference board. */
export const DEFAULT_DEVICE_CONFIG: DeviceConfig = {
  canSpeedKbps: 500,
  twaiTxPin: 22,
  twaiRxPin: 21,
}

/** Wire → domain. Pure; assumes input already passed `DeviceConfigWireSchema`. */
export function deviceConfigFromWire(wire: DeviceConfigWire): DeviceConfig {
  return {
    canSpeedKbps: wire.can_speed_kbps,
    twaiTxPin: wire.twai_tx_pin,
    twaiRxPin: wire.twai_rx_pin,
  }
}

/** Domain → wire. Pure; assumes input already passed `DeviceConfigSchema`. */
export function deviceConfigToWire(cfg: DeviceConfig): DeviceConfigWire {
  return {
    can_speed_kbps: cfg.canSpeedKbps,
    twai_tx_pin: cfg.twaiTxPin,
    twai_rx_pin: cfg.twaiRxPin,
  }
}
