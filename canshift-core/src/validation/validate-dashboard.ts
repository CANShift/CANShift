// validate-dashboard.ts — Dashboard config validation

export interface ValidationResult {
  valid: boolean
  errors: string[]
}

type UnknownRecord = Record<string, unknown>

const VALID_WIDGET_TYPES = [
  'gauge',
  'label',
  'warning',
  'button',
  'timer',
  'bar',
  'gear',
  'image',
] as const

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null
}

function str(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

/** Validate a DashboardConfig object. Returns all errors found. */
export function validateDashboard(config: unknown): ValidationResult {
  const errors: string[] = []

  if (!isRecord(config)) {
    return { valid: false, errors: ['Config must be an object'] }
  }

  if (typeof config.version !== 'string') {
    errors.push('Missing required field: version')
  }

  if (typeof config.name !== 'string' || config.name.length === 0) {
    errors.push('Missing required field: name')
  }

  if (typeof config.defaultPageId !== 'string') {
    errors.push('Missing required field: defaultPageId')
  }

  if (typeof config.revLimitRpm !== 'number' || config.revLimitRpm <= 0) {
    errors.push('revLimitRpm must be a positive number')
  }

  if (!Array.isArray(config.pages) || config.pages.length === 0) {
    errors.push('pages must be a non-empty array')
  } else {
    config.pages.forEach((page: unknown, idx: number) => {
      errors.push(...validatePage(page, idx))
    })

    const pageIds = config.pages.map((p: unknown) => (isRecord(p) ? str(p.id) : ''))
    if (typeof config.defaultPageId === 'string' && !pageIds.includes(config.defaultPageId)) {
      errors.push(`defaultPageId "${config.defaultPageId}" does not match any page id`)
    }
  }

  return { valid: errors.length === 0, errors }
}

function validatePage(page: unknown, idx: number): string[] {
  const errors: string[] = []
  const prefix = `pages[${idx.toString()}]`

  if (!isRecord(page)) {
    return [`${prefix} must be an object`]
  }

  if (typeof page.id !== 'string' || page.id.length === 0) {
    errors.push(`${prefix}.id is required`)
  }
  if (typeof page.name !== 'string') {
    errors.push(`${prefix}.name is required`)
  }
  if (!Array.isArray(page.widgets)) {
    errors.push(`${prefix}.widgets must be an array`)
  } else {
    page.widgets.forEach((w: unknown, wIdx: number) => {
      errors.push(...validateWidget(w, idx, wIdx))
    })
  }

  return errors
}

function validateWidget(widget: unknown, pageIdx: number, widgetIdx: number): string[] {
  const errors: string[] = []
  const prefix = `pages[${pageIdx.toString()}].widgets[${widgetIdx.toString()}]`

  if (!isRecord(widget)) {
    return [`${prefix} must be an object`]
  }

  if (typeof widget.id !== 'string') errors.push(`${prefix}.id is required`)
  if (typeof widget.type !== 'string') errors.push(`${prefix}.type is required`)

  if (
    typeof widget.type === 'string' &&
    !(VALID_WIDGET_TYPES as readonly string[]).includes(widget.type)
  ) {
    errors.push(`${prefix}.type "${widget.type}" is not a valid widget type`)
  }

  return errors
}
