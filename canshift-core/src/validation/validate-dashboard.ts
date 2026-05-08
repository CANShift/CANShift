// validate-dashboard.ts — Dashboard config validation

import {
  CAN_RAW_DATA_MAX_HEX_CHARS,
  CAN_RAW_DATA_REGEX,
  CANVAS,
  DECIMAL_PLACES,
  FIRMWARE_CAPS,
  HEX_COLOR_REGEX,
  REV_LIMIT_RPM,
  TOPBAR_HEIGHT,
} from '../constants/firmware-caps.js'
import type { SignalConfig } from '../types/signal.js'

export interface ValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
}

export interface ValidateDashboardOptions {
  /** External signal catalog (signals.json) used for cross-reference checks. */
  signalCatalog?: SignalConfig
}

type UnknownRecord = Record<string, unknown>

const VALID_WIDGET_TYPES = ['gauge', 'warning', 'button', 'timer', 'bar', 'gear', 'image'] as const
type KnownWidgetType = (typeof VALID_WIDGET_TYPES)[number]

const VALID_GAUGE_DISPLAY_STYLES = ['numeric', 'arc', 'bar'] as const
const VALID_GAUGE_ARC_FILL_STYLES = ['zones', 'gradient'] as const
const VALID_BAR_ORIENTATIONS = ['vertical', 'horizontal'] as const
const VALID_TIMER_FORMATS = ['mm:ss', 'ss.mmm'] as const

const TOPBAR_LAYOUT_ANY_SIGNAL = 'any'

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function str(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function isHexColor(value: unknown): boolean {
  return typeof value === 'string' && HEX_COLOR_REGEX.test(value)
}

function isInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && Number.isInteger(value)
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function isKnownWidgetType(value: unknown): value is KnownWidgetType {
  return typeof value === 'string' && (VALID_WIDGET_TYPES as readonly string[]).includes(value)
}

/** Validate a DashboardConfig object. Returns all errors found. */
export function validateDashboard(
  config: unknown,
  options?: ValidateDashboardOptions
): ValidationResult {
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

  errors.push(...validateRevLimit(config.revLimitRpm))

  if (isRecord(config.topBar)) {
    errors.push(...validateTopBar(config.topBar))
  }

  if (isRecord(config.dayTheme)) {
    errors.push(...validateThemePreset(config.dayTheme, 'dayTheme'))
  }

  // Signal catalog: external option takes priority over embedded config.signals
  const knownSignalIds = collectSignalIds(config, options?.signalCatalog)

  if (!Array.isArray(config.pages) || config.pages.length === 0) {
    errors.push('pages must be a non-empty array')
  } else {
    if (config.pages.length > FIRMWARE_CAPS.MAX_PAGES) {
      errors.push(
        `pages: too many pages (${config.pages.length.toString()} > ${FIRMWARE_CAPS.MAX_PAGES.toString()})`
      )
    }

    config.pages.forEach((page: unknown, idx: number) => {
      const { errors: pageErrors, warnings: pageWarnings } = validatePage(page, idx, knownSignalIds)
      errors.push(...pageErrors)
      warnings.push(...pageWarnings)
    })

    errors.push(...validatePageIdUniqueness(config.pages))
    errors.push(...validateDefaultPageId(config.defaultPageId, config.pages))
  }

  // Top-bar layout signal references against the catalog
  if (knownSignalIds !== null && isRecord(config.topBar) && Array.isArray(config.topBar.layout)) {
    warnings.push(...checkTopBarSignalRefs(config.topBar.layout, knownSignalIds))
  }

  return { valid: errors.length === 0, errors, warnings }
}

// ---------------------------------------------------------------------------
// Top-level helpers
// ---------------------------------------------------------------------------

function validateRevLimit(value: unknown): string[] {
  const errors: string[] = []
  if (typeof value !== 'number' || value <= 0) {
    errors.push('revLimitRpm must be a positive number')
    return errors
  }
  if (value < REV_LIMIT_RPM.MIN || value > REV_LIMIT_RPM.MAX) {
    errors.push(
      `revLimitRpm must be in [${REV_LIMIT_RPM.MIN.toString()}, ${REV_LIMIT_RPM.MAX.toString()}]`
    )
  }
  return errors
}

function validateTopBar(topBar: UnknownRecord): string[] {
  const errors: string[] = []

  if (typeof topBar.height !== 'number' || topBar.height <= 0) {
    errors.push('topBar.height must be a positive number')
  } else if (topBar.height < TOPBAR_HEIGHT.MIN || topBar.height > TOPBAR_HEIGHT.MAX) {
    errors.push(
      `topBar.height must be in [${TOPBAR_HEIGHT.MIN.toString()}, ${TOPBAR_HEIGHT.MAX.toString()}]`
    )
  }

  if (topBar.bgColor !== undefined && !isHexColor(topBar.bgColor)) {
    errors.push('topBar.bgColor must be a 6-digit hex color (e.g. "#0D0D0D")')
  }
  if (topBar.textColor !== undefined && !isHexColor(topBar.textColor)) {
    errors.push('topBar.textColor must be a 6-digit hex color (e.g. "#AAAAAA")')
  }

  if (topBar.layout !== undefined) {
    errors.push(...validateTopBarLayout(topBar.layout))
  }

  return errors
}

function validateThemePreset(theme: UnknownRecord, prefix: string): string[] {
  const errors: string[] = []

  if (theme.bgColor !== undefined && !isHexColor(theme.bgColor)) {
    errors.push(`${prefix}.bgColor must be a 6-digit hex color`)
  }
  if (isRecord(theme.palette)) {
    errors.push(...validatePalette(theme.palette, `${prefix}.palette`))
  }

  return errors
}

const PALETTE_FIELDS = [
  'surface',
  'primary',
  'accent',
  'text',
  'textDim',
  'warning',
  'danger',
  'success',
] as const

function validatePalette(palette: UnknownRecord, prefix: string): string[] {
  const errors: string[] = []
  for (const field of PALETTE_FIELDS) {
    const value = palette[field]
    if (value !== undefined && !isHexColor(value)) {
      errors.push(`${prefix}.${field} must be a 6-digit hex color`)
    }
  }
  return errors
}

function collectSignalIds(
  config: UnknownRecord,
  signalCatalog: SignalConfig | undefined
): Set<string> | null {
  // External catalog wins
  if (signalCatalog && Array.isArray(signalCatalog.signals)) {
    const ids = new Set<string>()
    for (const sig of signalCatalog.signals) {
      if (typeof sig.name === 'string') ids.add(sig.name)
    }
    return ids
  }

  // Legacy embedded fallback
  if (!Array.isArray(config.signals)) return null
  const ids = new Set<string>()
  for (const sig of config.signals) {
    if (isRecord(sig) && typeof sig.name === 'string') {
      ids.add(sig.name)
    }
  }
  return ids
}

function validatePageIdUniqueness(pages: unknown[]): string[] {
  const errors: string[] = []
  const seen = new Set<string>()
  const dupes = new Set<string>()
  pages.forEach((p: unknown) => {
    if (!isRecord(p)) return
    const id = str(p.id)
    if (id.length === 0) return
    if (seen.has(id)) dupes.add(id)
    else seen.add(id)
  })
  for (const id of dupes) {
    errors.push(`pages: duplicate page id "${id}"`)
  }
  return errors
}

function validateDefaultPageId(defaultPageId: unknown, pages: unknown[]): string[] {
  if (typeof defaultPageId !== 'string') return []
  let matched: UnknownRecord | null = null
  for (const p of pages) {
    if (isRecord(p) && str(p.id) === defaultPageId) {
      matched = p
      break
    }
  }
  if (matched === null) {
    return [`defaultPageId "${defaultPageId}" does not match any page id`]
  }
  if (matched.visible === false) {
    return [`defaultPageId "${defaultPageId}" refers to a page where visible is false`]
  }
  return []
}

// ---------------------------------------------------------------------------
// Page validation
// ---------------------------------------------------------------------------

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

  if (page.backgroundColor !== undefined && !isHexColor(page.backgroundColor)) {
    errors.push(`${prefix}.backgroundColor must be a 6-digit hex color`)
  }

  if (isRecord(page.palette)) {
    errors.push(...validatePalette(page.palette, `${prefix}.palette`))
  }

  if (!Array.isArray(page.widgets)) {
    errors.push(`${prefix}.widgets must be an array`)
  } else {
    if (page.widgets.length > FIRMWARE_CAPS.MAX_WIDGETS_PER_PAGE) {
      errors.push(
        `${prefix}.widgets: too many widgets (${page.widgets.length.toString()} > ${FIRMWARE_CAPS.MAX_WIDGETS_PER_PAGE.toString()})`
      )
    }
    page.widgets.forEach((w: unknown, wIdx: number) => {
      const { errors: wErrors, warnings: wWarnings } = validateWidget(w, idx, wIdx, knownSignalIds)
      errors.push(...wErrors)
      warnings.push(...wWarnings)
    })

    errors.push(...validateWidgetIdUniqueness(page.widgets, prefix))
  }

  return { errors, warnings }
}

function validateWidgetIdUniqueness(widgets: unknown[], prefix: string): string[] {
  const errors: string[] = []
  const seen = new Set<string>()
  const dupes = new Set<string>()
  widgets.forEach((w: unknown) => {
    if (!isRecord(w)) return
    const id = str(w.id)
    if (id.length === 0) return
    if (seen.has(id)) dupes.add(id)
    else seen.add(id)
  })
  for (const id of dupes) {
    errors.push(`${prefix}.widgets: duplicate widget id "${id}"`)
  }
  return errors
}

// ---------------------------------------------------------------------------
// Widget validation
// ---------------------------------------------------------------------------

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

  if (typeof widget.type === 'string' && !isKnownWidgetType(widget.type)) {
    errors.push(`${prefix}.type "${widget.type}" is not a valid widget type`)
  }

  // Layout bounds
  if (widget.layout !== undefined) {
    errors.push(...validateLayout(widget.layout, prefix))
  }

  // Style colors
  if (isRecord(widget.style)) {
    errors.push(...validateStyle(widget.style, prefix))
  }

  // Type-specific fields — exhaustive switch over KnownWidgetType
  if (isKnownWidgetType(widget.type)) {
    const cfg = isRecord(widget.config) ? widget.config : widget
    errors.push(...validateWidgetTypeFields(widget.type, widget, cfg, prefix))
  }

  // Signal cross-reference warning — Widget.signal is the canonical top-level field
  if (knownSignalIds !== null) {
    const signalId = typeof widget.signal === 'string' ? widget.signal : null
    if (signalId !== null && signalId.length > 0 && !knownSignalIds.has(signalId)) {
      warnings.push(
        `${prefix} references signal "${signalId}" which is not defined in config.signals`
      )
    }
  }

  return { errors, warnings }
}

function validateLayout(layout: unknown, prefix: string): string[] {
  const errors: string[] = []
  if (!isRecord(layout)) {
    errors.push(`${prefix}.layout must be an object`)
    return errors
  }

  const { x, y, w, h, zOrder } = layout

  if (!isInteger(x) || x < 0 || x >= CANVAS.WIDTH) {
    errors.push(`${prefix}.layout.x must be an integer in [0, ${CANVAS.WIDTH.toString()})`)
  }
  if (!isInteger(y) || y < 0 || y >= CANVAS.HEIGHT) {
    errors.push(`${prefix}.layout.y must be an integer in [0, ${CANVAS.HEIGHT.toString()})`)
  }
  if (!isInteger(w) || w < 1 || w > CANVAS.WIDTH) {
    errors.push(`${prefix}.layout.w must be an integer in [1, ${CANVAS.WIDTH.toString()}]`)
  }
  if (!isInteger(h) || h < 1 || h > CANVAS.HEIGHT) {
    errors.push(`${prefix}.layout.h must be an integer in [1, ${CANVAS.HEIGHT.toString()}]`)
  }

  if (isInteger(x) && isInteger(w) && x + w > CANVAS.WIDTH) {
    errors.push(
      `${prefix}.layout: x+w must be <= ${CANVAS.WIDTH.toString()} (got ${(x + w).toString()})`
    )
  }
  if (isInteger(y) && isInteger(h) && y + h > CANVAS.HEIGHT) {
    errors.push(
      `${prefix}.layout: y+h must be <= ${CANVAS.HEIGHT.toString()} (got ${(y + h).toString()})`
    )
  }

  if (!isFiniteNumber(zOrder)) {
    errors.push(`${prefix}.layout.zOrder must be a number`)
  }

  return errors
}

const STYLE_COLOR_FIELDS = [
  'primaryColor',
  'secondaryColor',
  'warningColor',
  'criticalColor',
  'textColor',
] as const

function validateStyle(style: UnknownRecord, prefix: string): string[] {
  const errors: string[] = []
  for (const field of STYLE_COLOR_FIELDS) {
    const value = style[field]
    if (value !== undefined && !isHexColor(value)) {
      errors.push(`${prefix}.style.${field} must be a 6-digit hex color`)
    }
  }
  // borderColor is optional and may be null
  if (
    style.borderColor !== undefined &&
    style.borderColor !== null &&
    !isHexColor(style.borderColor)
  ) {
    errors.push(`${prefix}.style.borderColor must be a 6-digit hex color or null`)
  }
  return errors
}

// ---------------------------------------------------------------------------
// Top-bar layout
// ---------------------------------------------------------------------------

const VALID_TOP_BAR_ITEM_TYPES = [
  'statusDot',
  'label',
  'separator',
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

  if (layout.length > FIRMWARE_CAPS.MAX_TOPBAR_ITEMS) {
    errors.push(
      `topBar.layout: too many items (${layout.length.toString()} > ${FIRMWARE_CAPS.MAX_TOPBAR_ITEMS.toString()})`
    )
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

function checkTopBarSignalRefs(layout: unknown[], known: Set<string>): string[] {
  const warnings: string[] = []
  layout.forEach((item: unknown, idx: number) => {
    if (!isRecord(item)) return
    if (item.type !== 'statusDot' && item.type !== 'signal') return
    const signal = typeof item.signal === 'string' ? item.signal : ''
    if (signal.length === 0) return
    if (signal === TOPBAR_LAYOUT_ANY_SIGNAL) return
    if (!known.has(signal)) {
      warnings.push(
        `topBar.layout[${idx.toString()}] references signal "${signal}" which is not defined in config.signals`
      )
    }
  })
  return warnings
}

// ---------------------------------------------------------------------------
// Widget-type-specific validation
// ---------------------------------------------------------------------------

function validateWidgetTypeFields(
  type: KnownWidgetType,
  widget: UnknownRecord,
  cfg: UnknownRecord,
  prefix: string
): string[] {
  switch (type) {
    case 'gauge':
      return validateGauge(cfg, prefix)
    case 'warning':
      return validateWarning(widget, cfg, prefix)
    case 'button':
      return validateButton(cfg, prefix)
    case 'timer':
      return validateTimer(cfg, prefix)
    case 'bar':
      return validateBar(cfg, prefix)
    case 'gear':
      return validateGear(cfg, prefix)
    case 'image':
      return validateImage(cfg, prefix)
    default: {
      const _exhaustive: never = type
      return [`${prefix}: unhandled widget type ${String(_exhaustive)}`]
    }
  }
}

function validateRangeBounds(cfg: UnknownRecord, label: string, prefix: string): string[] {
  const errors: string[] = []
  const minOk = isFiniteNumber(cfg.minValue)
  const maxOk = isFiniteNumber(cfg.maxValue)
  if (!minOk) errors.push(`${prefix} (${label}): minValue must be a number`)
  if (!maxOk) errors.push(`${prefix} (${label}): maxValue must be a number`)
  if (minOk && maxOk && (cfg.minValue as number) >= (cfg.maxValue as number)) {
    errors.push(`${prefix} (${label}): minValue must be less than maxValue`)
  }
  return errors
}

function validateThresholdsWithinRange(
  cfg: UnknownRecord,
  label: string,
  prefix: string
): string[] {
  const errors: string[] = []
  const minOk = isFiniteNumber(cfg.minValue)
  const maxOk = isFiniteNumber(cfg.maxValue)
  if (!minOk || !maxOk) return errors
  const min = cfg.minValue as number
  const max = cfg.maxValue as number

  if (isFiniteNumber(cfg.warningLevel)) {
    if (cfg.warningLevel < min || cfg.warningLevel > max) {
      errors.push(`${prefix} (${label}): warningLevel must be in [minValue, maxValue]`)
    }
  }
  if (isFiniteNumber(cfg.dangerLevel)) {
    if (cfg.dangerLevel < min || cfg.dangerLevel > max) {
      errors.push(`${prefix} (${label}): dangerLevel must be in [minValue, maxValue]`)
    }
  }
  return errors
}

function validateDecimalPlaces(cfg: UnknownRecord, label: string, prefix: string): string[] {
  if (cfg.decimalPlaces === undefined) {
    return [`${prefix} (${label}): decimalPlaces must be a number`]
  }
  if (
    !isInteger(cfg.decimalPlaces) ||
    cfg.decimalPlaces < DECIMAL_PLACES.MIN ||
    cfg.decimalPlaces > DECIMAL_PLACES.MAX
  ) {
    return [
      `${prefix} (${label}): decimalPlaces must be an integer in [${DECIMAL_PLACES.MIN.toString()}, ${DECIMAL_PLACES.MAX.toString()}]`,
    ]
  }
  return []
}

function validateGauge(cfg: UnknownRecord, prefix: string): string[] {
  const errors: string[] = []
  errors.push(...validateRangeBounds(cfg, 'gauge', prefix))
  errors.push(...validateThresholdsWithinRange(cfg, 'gauge', prefix))
  errors.push(...validateDecimalPlaces(cfg, 'gauge', prefix))

  if (cfg.alertThreshold !== undefined && !isFiniteNumber(cfg.alertThreshold)) {
    errors.push(`${prefix} (gauge): alertThreshold must be a number when set`)
  }

  if (cfg.barOrientation !== undefined) {
    if (
      typeof cfg.barOrientation !== 'string' ||
      !(VALID_BAR_ORIENTATIONS as readonly string[]).includes(cfg.barOrientation)
    ) {
      errors.push(`${prefix} (gauge): barOrientation must be 'vertical' or 'horizontal'`)
    }
  }

  if (cfg.displayStyle !== undefined) {
    if (
      typeof cfg.displayStyle !== 'string' ||
      !(VALID_GAUGE_DISPLAY_STYLES as readonly string[]).includes(cfg.displayStyle)
    ) {
      errors.push(`${prefix} (gauge): displayStyle must be 'numeric' | 'arc' | 'bar'`)
    }
  }

  if (cfg.arcFillStyle !== undefined) {
    if (
      typeof cfg.arcFillStyle !== 'string' ||
      !(VALID_GAUGE_ARC_FILL_STYLES as readonly string[]).includes(cfg.arcFillStyle)
    ) {
      errors.push(`${prefix} (gauge): arcFillStyle must be 'zones' or 'gradient'`)
    }
  }

  return errors
}

function validateWarning(widget: UnknownRecord, cfg: UnknownRecord, prefix: string): string[] {
  const errors: string[] = []
  if (typeof cfg.threshold !== 'number') {
    errors.push(`${prefix} (warning): threshold must be a number`)
  }
  // Warning widgets share the parent widget's signal field (canonical Widget.signal)
  if (typeof widget.signal !== 'string' || widget.signal.length === 0) {
    errors.push(`${prefix} (warning): signal must be a non-empty string`)
  }
  return errors
}

function validateButton(cfg: UnknownRecord, prefix: string): string[] {
  const errors: string[] = []

  if (typeof cfg.targetPageId !== 'undefined') {
    if (typeof cfg.targetPageId !== 'string' || cfg.targetPageId.length === 0) {
      errors.push(`${prefix} (button): targetPageId must be a non-empty string`)
    }
  } else if (!Array.isArray(cfg.actions)) {
    errors.push(`${prefix} (button): targetPageId must be a non-empty string`)
  }

  if (Array.isArray(cfg.actions)) {
    cfg.actions.forEach((action: unknown, idx: number) => {
      errors.push(...validateButtonAction(action, `${prefix} (button).actions[${idx.toString()}]`))
    })
  }

  // Optional colors block
  if (isRecord(cfg.colors)) {
    if (cfg.colors.normal !== undefined && !isHexColor(cfg.colors.normal)) {
      errors.push(`${prefix} (button): colors.normal must be a 6-digit hex color`)
    }
    if (cfg.colors.active !== undefined && !isHexColor(cfg.colors.active)) {
      errors.push(`${prefix} (button): colors.active must be a 6-digit hex color`)
    }
  }

  return errors
}

function validateButtonAction(action: unknown, prefix: string): string[] {
  if (!isRecord(action)) return []
  if (action.category !== 'ecu' || action.type !== 'can_raw') return []
  return validateCanRawData(action.data, prefix)
}

function validateCanRawData(data: unknown, prefix: string): string[] {
  if (typeof data !== 'string') {
    return [`${prefix}: data must be a string`]
  }
  const errors: string[] = []
  if (data.length > CAN_RAW_DATA_MAX_HEX_CHARS) {
    errors.push(
      `${prefix}: data must be at most ${CAN_RAW_DATA_MAX_HEX_CHARS.toString()} hex characters (8 bytes)`
    )
  }
  if (!CAN_RAW_DATA_REGEX.test(data)) {
    errors.push(`${prefix}: data must be even-length hex (e.g. "DEADBEEF")`)
  }
  return errors
}

function validateTimer(cfg: UnknownRecord, prefix: string): string[] {
  const errors: string[] = []
  if (cfg.format !== undefined) {
    if (
      typeof cfg.format !== 'string' ||
      !(VALID_TIMER_FORMATS as readonly string[]).includes(cfg.format)
    ) {
      errors.push(`${prefix} (timer): format must be 'mm:ss' or 'ss.mmm'`)
    }
  }
  if (cfg.autoStart !== undefined && typeof cfg.autoStart !== 'boolean') {
    errors.push(`${prefix} (timer): autoStart must be a boolean`)
  }
  return errors
}

function validateBar(cfg: UnknownRecord, prefix: string): string[] {
  const errors: string[] = []
  errors.push(...validateRangeBounds(cfg, 'bar', prefix))
  errors.push(...validateThresholdsWithinRange(cfg, 'bar', prefix))
  errors.push(...validateDecimalPlaces(cfg, 'bar', prefix))

  if (cfg.alertThreshold !== undefined && !isFiniteNumber(cfg.alertThreshold)) {
    errors.push(`${prefix} (bar): alertThreshold must be a number when set`)
  }
  return errors
}

function validateGear(cfg: UnknownRecord, prefix: string): string[] {
  const errors: string[] = []
  if (cfg.decimalPlaces !== 0) {
    errors.push(`${prefix} (gear): decimalPlaces must be 0`)
  }
  if (cfg.prefix !== undefined && typeof cfg.prefix !== 'string') {
    errors.push(`${prefix} (gear): prefix must be a string`)
  }
  if (cfg.suffix !== undefined && typeof cfg.suffix !== 'string') {
    errors.push(`${prefix} (gear): suffix must be a string`)
  }
  return errors
}

function validateImage(cfg: UnknownRecord, prefix: string): string[] {
  const errors: string[] = []
  if (typeof cfg.imagePath !== 'string' || cfg.imagePath.length === 0) {
    errors.push(`${prefix} (image): imagePath must be a non-empty string`)
  }
  return errors
}
