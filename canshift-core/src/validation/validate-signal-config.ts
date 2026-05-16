// validate-signal-config.ts — Signal catalog validation (issue #701)
//
// Wraps `SignalConfigSchema.safeParse` so consumers (mobile/studio IPC) get the
// same `ValidationResult` envelope as `validateDashboard`. The schema itself is
// the source of truth; this module only flattens Zod issues into the
// `{ valid, errors[], warnings[] }` shape used everywhere else in core.

import { SignalConfigSchema } from '../schemas/signal.js'

import type { ValidationResult } from './validate-dashboard.js'

/**
 * Validate a SignalConfig (signals.json) object. Returns all errors found via
 * Zod's `safeParse`, formatted as `path: message` strings to match the style
 * used by `validateDashboard`.
 *
 * Issue #701 covers: hex `canFrameId`, `byteLength` enum, `min < max`,
 * optional hex `bitMask`, and the `canSpeedKbps` enum.
 *
 * Note: ramp shape (`colorRamp.stops` length, ascending values) is the
 * companion concern in #700 — left out here to avoid stepping on that PR.
 */
export function validateSignalConfig(config: unknown): ValidationResult {
  const result = SignalConfigSchema.safeParse(config)

  if (result.success) {
    return { valid: true, errors: [], warnings: [] }
  }

  const errors = result.error.issues.map((issue) => {
    const path = issue.path.length > 0 ? issue.path.join('.') : '<root>'
    return `${path}: ${issue.message}`
  })

  return { valid: false, errors, warnings: [] }
}
