// validate-signals.ts — Signal catalog (signals.json) validation
//
// Mirrors the structure of validate-dashboard.ts: pure function, no I/O,
// returns ValidationResult with accumulated errors and warnings.

import { FIRMWARE_CAPS } from '../constants/firmware-caps.js'
import { CAN_SPEED_OPTIONS } from '../types/device.js'
import type { ValidationResult } from './validate-dashboard.js'

type UnknownRecord = Record<string, unknown>

/** 29-bit extended CAN identifier max — covers both standard (≤0x7FF) and extended frames. */
const CAN_FRAME_ID_MAX = 0x1fffffff

/** Allowed signal byte lengths (matches firmware decoder + SignalDef.byteLength). */
const VALID_BYTE_LENGTHS = [1, 2, 4] as const

/** A CAN frame is 8 bytes — startByte + byteLength must fit. */
const CAN_FRAME_BYTES = 8

/** Hex-string format: "0x" prefix followed by one or more hex digits. */
const CAN_FRAME_ID_REGEX = /^0x[0-9A-Fa-f]+$/

/** Optional bitmask hex-string format. */
const BIT_MASK_REGEX = /^0x[0-9A-Fa-f]+$/

const UNIT_MAX_LEN = 16

const TIMEOUT_MS_MIN = 1
const TIMEOUT_MS_MAX = 60_000

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function isInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && Number.isInteger(value)
}

/** Validate a SignalConfig object. Returns all errors and warnings found. */
export function validateSignals(config: unknown): ValidationResult {
  const errors: string[] = []
  const warnings: string[] = []

  if (!isRecord(config)) {
    return { valid: false, errors: ['Config must be an object'], warnings }
  }

  if (typeof config.version !== 'string' || config.version.length === 0) {
    errors.push('Missing required field: version')
  }

  if (typeof config.protocol !== 'string' || config.protocol.length === 0) {
    errors.push('Missing required field: protocol')
  }

  errors.push(...validateCanSpeed(config.canSpeedKbps))

  if (!Array.isArray(config.signals)) {
    errors.push('signals must be an array')
    return { valid: errors.length === 0, errors, warnings }
  }

  if (config.signals.length > FIRMWARE_CAPS.MAX_SIGNALS) {
    errors.push(
      `signals: too many entries (${config.signals.length.toString()} > ${FIRMWARE_CAPS.MAX_SIGNALS.toString()})`
    )
  }

  config.signals.forEach((sig: unknown, idx: number) => {
    errors.push(...validateSignal(sig, idx))
  })

  errors.push(...validateUniqueNames(config.signals))

  return { valid: errors.length === 0, errors, warnings }
}

// ---------------------------------------------------------------------------
// Top-level helpers
// ---------------------------------------------------------------------------

function validateCanSpeed(value: unknown): string[] {
  if (!isInteger(value) || !(CAN_SPEED_OPTIONS as readonly number[]).includes(value)) {
    return [`canSpeedKbps must be one of: ${CAN_SPEED_OPTIONS.join(' | ')}`]
  }
  return []
}

function validateUniqueNames(signals: unknown[]): string[] {
  const errors: string[] = []
  const seen = new Set<string>()
  const dupes = new Set<string>()
  for (const sig of signals) {
    if (!isRecord(sig)) continue
    const name = typeof sig.name === 'string' ? sig.name : ''
    if (name.length === 0) continue
    if (seen.has(name)) dupes.add(name)
    else seen.add(name)
  }
  for (const name of dupes) {
    errors.push(`signals: duplicate signal name "${name}"`)
  }
  return errors
}

// ---------------------------------------------------------------------------
// Per-signal validation
// ---------------------------------------------------------------------------

function validateSignal(signal: unknown, idx: number): string[] {
  const errors: string[] = []
  const prefix = `signals[${idx.toString()}]`

  if (!isRecord(signal)) {
    return [`${prefix} must be an object`]
  }

  if (typeof signal.name !== 'string' || signal.name.length === 0) {
    errors.push(`${prefix}.name is required`)
  }

  errors.push(...validateCanFrameId(signal.canFrameId, prefix))
  errors.push(...validateByteLayout(signal, prefix))
  errors.push(...validateEndiannessFlags(signal, prefix))
  errors.push(...validateBitMask(signal.bitMask, prefix))
  errors.push(...validateScaleOffset(signal, prefix))
  errors.push(...validateRange(signal, prefix))
  errors.push(...validateThresholds(signal, prefix))
  errors.push(...validateUnit(signal.unit, prefix))
  errors.push(...validateTimeoutMs(signal.timeoutMs, prefix))

  return errors
}

function validateCanFrameId(value: unknown, prefix: string): string[] {
  if (typeof value !== 'string') {
    return [`${prefix}.canFrameId must be a hex string (e.g. "0x370")`]
  }
  if (!CAN_FRAME_ID_REGEX.test(value)) {
    return [`${prefix}.canFrameId must match /^0x[0-9A-Fa-f]+$/ (got "${value}")`]
  }
  const parsed = Number.parseInt(value, 16)
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > CAN_FRAME_ID_MAX) {
    return [
      `${prefix}.canFrameId must be in [0, 0x${CAN_FRAME_ID_MAX.toString(16).toUpperCase()}] (got "${value}")`,
    ]
  }
  return []
}

function validateByteLayout(signal: UnknownRecord, prefix: string): string[] {
  const errors: string[] = []

  const byteLength = signal.byteLength
  const startByte = signal.startByte

  const byteLengthOk =
    isInteger(byteLength) && (VALID_BYTE_LENGTHS as readonly number[]).includes(byteLength)
  if (!byteLengthOk) {
    errors.push(
      `${prefix}.byteLength must be one of: ${VALID_BYTE_LENGTHS.join(' | ')} (got ${String(byteLength)})`
    )
  }

  const startByteOk = isInteger(startByte) && startByte >= 0 && startByte <= CAN_FRAME_BYTES - 1
  if (!startByteOk) {
    errors.push(
      `${prefix}.startByte must be an integer in [0, ${(CAN_FRAME_BYTES - 1).toString()}]`
    )
  }

  if (byteLengthOk && startByteOk && startByte + byteLength > CAN_FRAME_BYTES) {
    errors.push(
      `${prefix}: startByte + byteLength must be <= ${CAN_FRAME_BYTES.toString()} (got ${(startByte + byteLength).toString()})`
    )
  }

  return errors
}

function validateEndiannessFlags(signal: UnknownRecord, prefix: string): string[] {
  const errors: string[] = []
  if (typeof signal.bigEndian !== 'boolean') {
    errors.push(`${prefix}.bigEndian must be a boolean`)
  }
  if (typeof signal.signed !== 'boolean') {
    errors.push(`${prefix}.signed must be a boolean`)
  }
  return errors
}

function validateBitMask(value: unknown, prefix: string): string[] {
  if (value === undefined) return []
  if (typeof value !== 'string' || !BIT_MASK_REGEX.test(value)) {
    return [`${prefix}.bitMask must be a hex string (e.g. "0x01") when set`]
  }
  return []
}

function validateScaleOffset(signal: UnknownRecord, prefix: string): string[] {
  const errors: string[] = []
  if (!isFiniteNumber(signal.scale)) {
    errors.push(`${prefix}.scale must be a finite number`)
  }
  if (!isFiniteNumber(signal.offset)) {
    errors.push(`${prefix}.offset must be a finite number`)
  }
  return errors
}

function validateRange(signal: UnknownRecord, prefix: string): string[] {
  const errors: string[] = []
  const minOk = isFiniteNumber(signal.min)
  const maxOk = isFiniteNumber(signal.max)
  if (!minOk) errors.push(`${prefix}.min must be a finite number`)
  if (!maxOk) errors.push(`${prefix}.max must be a finite number`)
  if (minOk && maxOk && (signal.min as number) >= (signal.max as number)) {
    errors.push(`${prefix}: min must be less than max`)
  }
  return errors
}

function validateThresholds(signal: UnknownRecord, prefix: string): string[] {
  const errors: string[] = []
  const minOk = isFiniteNumber(signal.min)
  const maxOk = isFiniteNumber(signal.max)
  const min = minOk ? (signal.min as number) : null
  const max = maxOk ? (signal.max as number) : null

  const warningOk = signal.warningLevel === undefined || isFiniteNumber(signal.warningLevel)
  const dangerOk = signal.dangerLevel === undefined || isFiniteNumber(signal.dangerLevel)

  if (signal.warningLevel !== undefined && !isFiniteNumber(signal.warningLevel)) {
    errors.push(`${prefix}.warningLevel must be a finite number when set`)
  }
  if (signal.dangerLevel !== undefined && !isFiniteNumber(signal.dangerLevel)) {
    errors.push(`${prefix}.dangerLevel must be a finite number when set`)
  }

  if (warningOk && isFiniteNumber(signal.warningLevel) && min !== null && max !== null) {
    if (signal.warningLevel < min || signal.warningLevel > max) {
      errors.push(`${prefix}.warningLevel must be in [min, max]`)
    }
  }
  if (dangerOk && isFiniteNumber(signal.dangerLevel) && min !== null && max !== null) {
    if (signal.dangerLevel < min || signal.dangerLevel > max) {
      errors.push(`${prefix}.dangerLevel must be in [min, max]`)
    }
  }

  // Note: warningLevel vs dangerLevel ordering is intentionally NOT enforced.
  // "High" alarms (rpm, coolant temp) use warning <= danger; "low" alarms
  // (oil pressure, fuel level, battery voltage) invert them — both are valid.

  return errors
}

function validateUnit(value: unknown, prefix: string): string[] {
  if (typeof value !== 'string') {
    return [`${prefix}.unit must be a string`]
  }
  if (value.length > UNIT_MAX_LEN) {
    return [`${prefix}.unit must be <= ${UNIT_MAX_LEN.toString()} characters`]
  }
  return []
}

function validateTimeoutMs(value: unknown, prefix: string): string[] {
  if (!isInteger(value) || value < TIMEOUT_MS_MIN || value > TIMEOUT_MS_MAX) {
    return [
      `${prefix}.timeoutMs must be an integer in [${TIMEOUT_MS_MIN.toString()}, ${TIMEOUT_MS_MAX.toString()}]`,
    ]
  }
  return []
}
