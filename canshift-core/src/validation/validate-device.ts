// validate-device.ts — Device config (device.json) validation
//
// Mirrors the structure of validate-dashboard.ts: pure function, no I/O,
// returns ValidationResult with accumulated errors and warnings.

import { CAN_SPEED_OPTIONS } from '../types/device.js'
import type { ValidationResult } from './validate-dashboard.js'

type UnknownRecord = Record<string, unknown>

/** ESP32 GPIO range — pins 0..39 exist, but 6..11 are reserved for SPI flash. */
const GPIO_MIN = 0
const GPIO_MAX = 39

/** GPIOs reserved for the integrated SPI flash on most ESP32 modules. */
const RESERVED_FLASH_GPIOS: ReadonlySet<number> = new Set([6, 7, 8, 9, 10, 11])

/** GPIOs that exist but are input-only on ESP32 (no output drive). */
const INPUT_ONLY_GPIOS: ReadonlySet<number> = new Set([34, 35, 36, 39])

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && Number.isInteger(value)
}

/** Validate a DeviceConfig object. Returns all errors and warnings found. */
export function validateDevice(config: unknown): ValidationResult {
  const errors: string[] = []
  const warnings: string[] = []

  if (!isRecord(config)) {
    return { valid: false, errors: ['Config must be an object'], warnings }
  }

  errors.push(...validateCanSpeed(config.can_speed_kbps))
  errors.push(...validateGpioPin(config.twai_tx_pin, 'twai_tx_pin'))
  errors.push(...validateGpioPin(config.twai_rx_pin, 'twai_rx_pin'))
  errors.push(...validatePinsDistinct(config))

  warnings.push(...warnInputOnlyTxPin(config.twai_tx_pin))

  return { valid: errors.length === 0, errors, warnings }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function validateCanSpeed(value: unknown): string[] {
  if (!isInteger(value) || !(CAN_SPEED_OPTIONS as readonly number[]).includes(value)) {
    return [`can_speed_kbps must be one of: ${CAN_SPEED_OPTIONS.join(' | ')}`]
  }
  return []
}

function validateGpioPin(value: unknown, field: string): string[] {
  if (!isInteger(value) || value < GPIO_MIN || value > GPIO_MAX) {
    return [
      `${field} must be an integer in [${GPIO_MIN.toString()}, ${GPIO_MAX.toString()}] (got ${String(value)})`,
    ]
  }
  if (RESERVED_FLASH_GPIOS.has(value)) {
    return [`${field} must not use SPI-flash-reserved GPIO ${value.toString()} (reserved: 6-11)`]
  }
  return []
}

function validatePinsDistinct(config: UnknownRecord): string[] {
  const tx = config.twai_tx_pin
  const rx = config.twai_rx_pin
  if (isInteger(tx) && isInteger(rx) && tx === rx) {
    return [`twai_tx_pin and twai_rx_pin must be different GPIOs (both = ${tx.toString()})`]
  }
  return []
}

function warnInputOnlyTxPin(value: unknown): string[] {
  if (isInteger(value) && INPUT_ONLY_GPIOS.has(value)) {
    return [
      `twai_tx_pin uses input-only GPIO ${value.toString()} (input-only: 34, 35, 36, 39) — TX will not drive`,
    ]
  }
  return []
}
