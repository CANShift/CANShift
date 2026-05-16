// schemas/device.ts — Zod schema for the on-device hardware config.
//
// `DeviceConfig` is the inter-package contract for ESP32 hardware settings
// (CAN bus speed + TWAI GPIO pins) persisted by canshift-studio to
// `userData/device.json` and consumed by canshift-firmware at boot.
//
// Issue #789 — moves the runtime schema previously mirrored in
// `canshift-studio/main/ipc/ipc-handlers.ts` into core, so the studio IPC
// boundary and any future mobile/firmware consumer parse against a single
// source of truth. The `DeviceConfig` type in `types/device.ts` is derived
// from this schema via `z.infer`. `CanSpeedKbpsSchema` lives in
// `./signal.js` (single source of truth per #778).

import { z } from 'zod'

import { CanSpeedKbpsSchema } from './signal.js'

/** ESP32 GPIO pin range — matches the chip's addressable IO pins. */
const ESP32_GPIO_MIN = 0
const ESP32_GPIO_MAX = 39

/** ESP32 GPIO pin index — integer in `[0, 39]`. */
export const Esp32GpioSchema = z.number().int().min(ESP32_GPIO_MIN).max(ESP32_GPIO_MAX)

/**
 * On-device hardware configuration persisted to `userData/device.json`.
 * Strict — extra fields are rejected so a stale studio payload can't smuggle
 * unknown keys through the IPC boundary into the file on disk.
 */
export const DeviceConfigSchema = z
  .object({
    /** CAN bus speed in kbps — must match ECU output configuration */
    can_speed_kbps: CanSpeedKbpsSchema,
    /** ESP32 TWAI TX GPIO pin */
    twai_tx_pin: Esp32GpioSchema,
    /** ESP32 TWAI RX GPIO pin */
    twai_rx_pin: Esp32GpioSchema,
  })
  .strict()

export type DeviceConfig = z.infer<typeof DeviceConfigSchema>
