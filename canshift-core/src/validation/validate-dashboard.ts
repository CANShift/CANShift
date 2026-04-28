// validate-dashboard.ts — Dashboard config validation

import type { DashboardConfig } from '../types/dashboard'

export interface ValidationResult {
  valid: boolean
  errors: string[]
}

/** Validate a DashboardConfig object. Returns all errors found. */
export function validateDashboard(config: unknown): ValidationResult {
  const errors: string[] = []

  if (!config || typeof config !== 'object') {
    return { valid: false, errors: ['Config must be an object'] }
  }

  const c = config as Record<string, unknown>

  if (typeof c['version'] !== 'string') {
    errors.push('Missing required field: version')
  }

  if (typeof c['name'] !== 'string' || (c['name'] as string).length === 0) {
    errors.push('Missing required field: name')
  }

  if (typeof c['defaultPageId'] !== 'string') {
    errors.push('Missing required field: defaultPageId')
  }

  if (typeof c['revLimitRpm'] !== 'number' || (c['revLimitRpm'] as number) <= 0) {
    errors.push('revLimitRpm must be a positive number')
  }

  if (!Array.isArray(c['pages']) || (c['pages'] as unknown[]).length === 0) {
    errors.push('pages must be a non-empty array')
  } else {
    const pages = c['pages'] as unknown[]
    pages.forEach((page, idx) => {
      const pageErrors = validatePage(page, idx)
      errors.push(...pageErrors)
    })

    // Verify defaultPageId references an existing page
    const pageIds = pages.map((p) =>
      (p as Record<string, unknown>)['id'] as string
    )
    if (c['defaultPageId'] && !pageIds.includes(c['defaultPageId'] as string)) {
      errors.push(
        `defaultPageId "${c['defaultPageId']}" does not match any page id`
      )
    }
  }

  return { valid: errors.length === 0, errors }
}

function validatePage(page: unknown, idx: number): string[] {
  const errors: string[] = []
  const prefix = `pages[${idx}]`

  if (!page || typeof page !== 'object') {
    return [`${prefix} must be an object`]
  }

  const p = page as Record<string, unknown>

  if (typeof p['id'] !== 'string' || (p['id'] as string).length === 0) {
    errors.push(`${prefix}.id is required`)
  }
  if (typeof p['name'] !== 'string') {
    errors.push(`${prefix}.name is required`)
  }
  if (!Array.isArray(p['widgets'])) {
    errors.push(`${prefix}.widgets must be an array`)
  } else {
    const widgets = p['widgets'] as unknown[]
    widgets.forEach((w, wIdx) => {
      const wErrors = validateWidget(w, idx, wIdx)
      errors.push(...wErrors)
    })
  }

  return errors
}

function validateWidget(widget: unknown, pageIdx: number, widgetIdx: number): string[] {
  const errors: string[] = []
  const prefix = `pages[${pageIdx}].widgets[${widgetIdx}]`

  if (!widget || typeof widget !== 'object') {
    return [`${prefix} must be an object`]
  }

  const w = widget as Record<string, unknown>

  if (typeof w['id'] !== 'string') errors.push(`${prefix}.id is required`)
  if (typeof w['type'] !== 'string') errors.push(`${prefix}.type is required`)

  const validTypes = ['gauge','label','warning','button','timer','bar','gear','image']
  if (typeof w['type'] === 'string' && !validTypes.includes(w['type'])) {
    errors.push(`${prefix}.type "${w['type']}" is not a valid widget type`)
  }

  return errors
}
