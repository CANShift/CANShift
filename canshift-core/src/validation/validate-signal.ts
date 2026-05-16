// validate-signal.ts — Signal catalog validation
//
// Issue #700: enforce firmware-side caps on `colorRamp.stops` so Studio cannot
// emit configs that look valid but get silently truncated on-device. The
// firmware mirrors `MAX_RAMP_STOPS` as a fixed C array
// (`canshift-firmware/include/app_config.h`), so over-cap stops are dropped at
// load time. The same envelope shape as `validateDashboard` is used so callers
// can merge errors/warnings transparently.

import { FIRMWARE_CAPS } from '../constants/firmware-caps.js'
import type { SignalConfig } from '../types/signal.js'

import type { ValidationResult } from './validate-dashboard.js'

const MIN_RAMP_STOPS = 2

/**
 * Validate a `SignalConfig` (signals.json) against firmware caps and structural
 * invariants that the Zod schema does not yet encode.
 *
 * Currently checks:
 *  - `colorRamp.stops.length` ∈ `[MIN_RAMP_STOPS, FIRMWARE_CAPS.MAX_RAMP_STOPS]`
 *  - `colorRamp.stops[*].value` is strictly ascending
 */
export function validateSignalCatalog(catalog: SignalConfig): ValidationResult {
  const errors: string[] = []
  const warnings: string[] = []

  catalog.signals.forEach((signal, idx) => {
    const ramp = signal.colorRamp
    if (!ramp) return
    const prefix = `signals[${idx.toString()}] (${signal.name}).colorRamp`
    errors.push(...validateRampStops(ramp.stops, prefix))
  })

  return { valid: errors.length === 0, errors, warnings }
}

/** Validate a `colorRamp.stops` array — length bounds + strictly-ascending values. */
export function validateRampStops(stops: readonly { value: number }[], prefix: string): string[] {
  const errors: string[] = []

  if (stops.length < MIN_RAMP_STOPS) {
    errors.push(
      `${prefix}.stops: too few stops (${stops.length.toString()} < ${MIN_RAMP_STOPS.toString()})`
    )
  }

  if (stops.length > FIRMWARE_CAPS.MAX_RAMP_STOPS) {
    errors.push(
      `${prefix}.stops: too many stops (${stops.length.toString()} > ${FIRMWARE_CAPS.MAX_RAMP_STOPS.toString()})`
    )
  }

  for (let i = 1; i < stops.length; i++) {
    const prev = stops[i - 1]
    const curr = stops[i]
    if (prev === undefined || curr === undefined) continue
    if (curr.value <= prev.value) {
      errors.push(
        `${prefix}.stops[${i.toString()}]: value (${curr.value.toString()}) must be strictly greater than previous (${prev.value.toString()})`
      )
    }
  }

  return errors
}
