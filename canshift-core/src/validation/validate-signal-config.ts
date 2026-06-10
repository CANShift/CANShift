import { SignalConfigSchema } from '../schemas/signal.js'

import type { ValidationResult } from './validate-dashboard.js'

export const validateSignalConfig = (config: unknown): ValidationResult => {
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
