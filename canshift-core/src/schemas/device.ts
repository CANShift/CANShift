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

import { z } from 'zod'

import { CanSpeedKbpsSchema } from './signal.js'

/** ESP32 GPIO pin range — matches the chip's addressable IO pins. */
const ESP32_GPIO_MIN = 0
const ESP32_GPIO_MAX = 39

/** ESP32 GPIO pin index — integer in `[0, 39]`. */
export const Esp32GpioSchema = z.number().int().min(ESP32_GPIO_MIN).max(ESP32_GPIO_MAX)

/**
 * Pins wired to the internal SPI flash on ESP32-WROOM modules. Configuring
 * these as user IO at runtime corrupts flash and bricks the board until
 * reflash over ESP-PROG. Mirrors the warning in `board_config.h`.
 */
const ESP32_SPI_FLASH_PINS: ReadonlySet<number> = new Set([6, 7, 8, 9, 10, 11])

/**
 * ESP32 GPIO pin usable as a digital input (issue #833). Accepts the full
 * `[0, 39]` range MINUS the SPI flash pins. Pins 34-39 ARE allowed here even
 * though they are input-only — that's exactly the use case (button-to-GND).
 *
 * Note this is intentionally more permissive than the (future) output-only
 * schema: TWAI TX needs output-capable pins (rejects 34-39), while a GPIO
 * button only reads, so 34-39 are fine.
 */
export const Esp32InputGpioSchema = Esp32GpioSchema.refine(
  (pin) => !ESP32_SPI_FLASH_PINS.has(pin),
  {
    message:
      'GPIO 6-11 are wired to the SPI flash chip — using them as IO bricks the device',
  }
)

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
    /** ESP32 TWAI TX GPIO pin */
    twai_tx_pin: Esp32GpioSchema,
    /** ESP32 TWAI RX GPIO pin */
    twai_rx_pin: Esp32GpioSchema,
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
    twaiTxPin: Esp32GpioSchema,
    /** ESP32 TWAI RX GPIO pin */
    twaiRxPin: Esp32GpioSchema,
  })
  .strict()

export type DeviceConfig = z.infer<typeof DeviceConfigSchema>

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
