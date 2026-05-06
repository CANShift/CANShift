// validate-dashboard.ts — Dashboard config validation

export interface ValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
}

type UnknownRecord = Record<string, unknown>

const VALID_WIDGET_TYPES = ['gauge', 'warning', 'button', 'timer', 'bar', 'gear', 'image'] as const

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null
}

function str(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

/** Validate a DashboardConfig object. Returns all errors found. */
export function validateDashboard(config: unknown): ValidationResult {
  const errors: string[] = []
  const warnings: string[] = []

  if (!isRecord(config)) {
    return { valid: false, errors: ['Config must be an object'], warnings }
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

  if (isRecord(config.topBar)) {
    if (typeof config.topBar.height !== 'number' || config.topBar.height <= 0) {
      errors.push('topBar.height must be a positive number')
    }
    if (config.topBar.layout !== undefined) {
      errors.push(...validateTopBarLayout(config.topBar.layout))
    }
  }

  // Collect known signal ids for cross-reference checks
  const knownSignalIds = collectSignalIds(config)

  if (!Array.isArray(config.pages) || config.pages.length === 0) {
    errors.push('pages must be a non-empty array')
  } else {
    config.pages.forEach((page: unknown, idx: number) => {
      const { errors: pageErrors, warnings: pageWarnings } = validatePage(page, idx, knownSignalIds)
      errors.push(...pageErrors)
      warnings.push(...pageWarnings)
    })

    const pageIds = config.pages.map((p: unknown) => (isRecord(p) ? str(p.id) : ''))
    if (typeof config.defaultPageId === 'string' && !pageIds.includes(config.defaultPageId)) {
      errors.push(`defaultPageId "${config.defaultPageId}" does not match any page id`)
    }
  }

  return { valid: errors.length === 0, errors, warnings }
}

/** Extract signal ids from config.signals if present */
function collectSignalIds(config: UnknownRecord): Set<string> | null {
  if (!Array.isArray(config.signals)) return null
  const ids = new Set<string>()
  for (const sig of config.signals) {
    if (isRecord(sig) && typeof sig.name === 'string') {
      ids.add(sig.name)
    }
  }
  return ids
}

function validatePage(
  page: unknown,
  idx: number,
  knownSignalIds: Set<string> | null
): { errors: string[]; warnings: string[] } {
  const errors: string[] = []
  const warnings: string[] = []
  const prefix = `pages[${idx.toString()}]`

  if (!isRecord(page)) {
    return { errors: [`${prefix} must be an object`], warnings }
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
      const { errors: wErrors, warnings: wWarnings } = validateWidget(w, idx, wIdx, knownSignalIds)
      errors.push(...wErrors)
      warnings.push(...wWarnings)
    })
  }

  return { errors, warnings }
}

function validateWidget(
  widget: unknown,
  pageIdx: number,
  widgetIdx: number,
  knownSignalIds: Set<string> | null
): { errors: string[]; warnings: string[] } {
  const errors: string[] = []
  const warnings: string[] = []
  const prefix = `pages[${pageIdx.toString()}].widgets[${widgetIdx.toString()}]`

  if (!isRecord(widget)) {
    return { errors: [`${prefix} must be an object`], warnings }
  }

  if (typeof widget.id !== 'string') errors.push(`${prefix}.id is required`)
  if (typeof widget.type !== 'string') errors.push(`${prefix}.type is required`)

  if (
    typeof widget.type === 'string' &&
    !(VALID_WIDGET_TYPES as readonly string[]).includes(widget.type)
  ) {
    errors.push(`${prefix}.type "${widget.type}" is not a valid widget type`)
  }

  // Widget-type-specific validation — operates on the config sub-object when
  // present, but also accepts flat widget objects for backwards compatibility.
  const cfg = isRecord(widget.config) ? widget.config : widget

  if (typeof widget.type === 'string') {
    errors.push(...validateWidgetTypeFields(widget.type, cfg, prefix))
  }

  // Signal cross-reference warning
  if (knownSignalIds !== null) {
    const signalId =
      typeof widget.signalId === 'string'
        ? widget.signalId
        : isRecord(widget.config) && typeof widget.config.signalId === 'string'
          ? widget.config.signalId
          : null

    if (signalId !== null && !knownSignalIds.has(signalId)) {
      warnings.push(
        `${prefix} references signalId "${signalId}" which is not defined in config.signals`
      )
    }
  }

  return { errors, warnings }
}

const VALID_TOP_BAR_ITEM_TYPES = [
  'statusDot',
  'label',
  'separator',
  'pageName',
  'signal',
  'usbIcon',
  'themeToggle',
] as const

const VALID_TOP_BAR_POSITIONS = ['left', 'center', 'right'] as const

function validateTopBarLayout(layout: unknown): string[] {
  const errors: string[] = []

  if (!Array.isArray(layout)) {
    errors.push('topBar.layout must be an array')
    return errors
  }

  layout.forEach((item: unknown, idx: number) => {
    const prefix = `topBar.layout[${idx.toString()}]`

    if (!isRecord(item)) {
      errors.push(`${prefix} must be an object`)
      return
    }

    const itemType = item.type
    if (typeof itemType !== 'string') {
      errors.push(`${prefix}.type is required`)
      return
    }
    if (!(VALID_TOP_BAR_ITEM_TYPES as readonly string[]).includes(itemType)) {
      errors.push(`${prefix}.type "${itemType}" is not a valid top-bar item type`)
    }

    if (
      typeof item.position !== 'string' ||
      !(VALID_TOP_BAR_POSITIONS as readonly string[]).includes(item.position)
    ) {
      errors.push(`${prefix}.position must be one of: left | center | right`)
    }

    if (
      (itemType === 'statusDot' || itemType === 'signal') &&
      (typeof item.signal !== 'string' || item.signal.length === 0)
    ) {
      errors.push(`${prefix} (${itemType}): signal must be a non-empty string`)
    }

    if (itemType === 'label' && (typeof item.text !== 'string' || item.text.length === 0)) {
      errors.push(`${prefix} (label): text must be a non-empty string`)
    }
  })

  return errors
}

function validateWidgetTypeFields(type: string, cfg: UnknownRecord, prefix: string): string[] {
  const errors: string[] = []

  switch (type) {
    case 'gauge': {
      if (typeof cfg.minValue !== 'number') {
        errors.push(`${prefix} (gauge): minValue must be a number`)
      }
      if (typeof cfg.maxValue !== 'number') {
        errors.push(`${prefix} (gauge): maxValue must be a number`)
      }
      if (
        typeof cfg.minValue === 'number' &&
        typeof cfg.maxValue === 'number' &&
        cfg.minValue >= cfg.maxValue
      ) {
        errors.push(`${prefix} (gauge): minValue must be less than maxValue`)
      }
      break
    }

    case 'warning': {
      if (typeof cfg.threshold !== 'number') {
        errors.push(`${prefix} (warning): threshold must be a number`)
      }
      if (typeof cfg.signalId !== 'string' || cfg.signalId.length === 0) {
        errors.push(`${prefix} (warning): signalId must be a non-empty string`)
      }
      break
    }

    case 'button': {
      if (typeof cfg.targetPageId !== 'undefined') {
        // Legacy field — validated as non-empty string if present
        if (typeof cfg.targetPageId !== 'string' || cfg.targetPageId.length === 0) {
          errors.push(`${prefix} (button): targetPageId must be a non-empty string`)
        }
      } else if (!Array.isArray(cfg.actions)) {
        errors.push(`${prefix} (button): targetPageId must be a non-empty string`)
      }
      break
    }

    case 'bar': {
      if (typeof cfg.minValue !== 'number') {
        errors.push(`${prefix} (bar): minValue must be a number`)
      }
      if (typeof cfg.maxValue !== 'number') {
        errors.push(`${prefix} (bar): maxValue must be a number`)
      }
      if (
        typeof cfg.minValue === 'number' &&
        typeof cfg.maxValue === 'number' &&
        cfg.minValue >= cfg.maxValue
      ) {
        errors.push(`${prefix} (bar): minValue must be less than maxValue`)
      }
      break
    }
  }

  return errors
}
