// validate-dashboard.ts — Dashboard config validation
//
// Issue #874: the Zod `DashboardConfigSchema` (`../schemas/dashboard.ts`) is
// now the sole source of structural truth. This module only:
//
//   1. Delegates shape + range + cap validation to Zod.
//   2. Adds cross-document checks Zod cannot express on its own
//      (defaultPageId must reference a visible page, id uniqueness across
//       pages/widgets, signal cross-reference warnings against a catalog).
//
// The previous hand-rolled type validators caused drift in production —
// `cruise_control` actions and `trackBadge` topbar items were accepted by the
// schema but silently rejected here. Removing the second source of truth
// prevents the class of bug entirely.

import type { z } from 'zod'

import { DashboardConfigSchema } from '../schemas/dashboard.js'
import type { SignalConfig } from '../types/signal.js'

import { validateSignalCatalog } from './validate-signal.js'

export interface ValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
}

export interface ValidateDashboardOptions {
  /** External signal catalog (signals.json) used for cross-reference checks. */
  signalCatalog?: SignalConfig
}

const TOPBAR_LAYOUT_ANY_SIGNAL = 'any'

/** Validate a DashboardConfig object. Returns all errors found. */
export function validateDashboard(
  config: unknown,
  options?: ValidateDashboardOptions
): ValidationResult {
  const errors: string[] = []
  const warnings: string[] = []

  const parsed = DashboardConfigSchema.safeParse(config)

  if (!parsed.success) {
    errors.push(...formatZodIssues(parsed.error.issues))
    // Run the signal catalog check anyway so authors get all errors at once.
    if (options?.signalCatalog) {
      const sigResult = validateSignalCatalog(options.signalCatalog)
      errors.push(...sigResult.errors)
      warnings.push(...sigResult.warnings)
    }
    return { valid: false, errors, warnings }
  }

  const dashboard = parsed.data

  // ---- Cross-field rules Zod can't express cleanly ----

  errors.push(...validateDefaultPageId(dashboard))
  errors.push(...validatePageIdUniqueness(dashboard.pages))
  dashboard.pages.forEach((page, idx) => {
    errors.push(...validateWidgetIdUniqueness(page.widgets, idx))
  })

  // ---- Signal cross-reference (catalog → warnings only) ----

  const knownSignalIds = collectSignalIds(config, options?.signalCatalog)
  if (knownSignalIds !== null) {
    warnings.push(...checkWidgetSignalRefs(dashboard.pages, knownSignalIds))
    if (dashboard.topBar.layout) {
      warnings.push(...checkTopBarSignalRefs(dashboard.topBar.layout, knownSignalIds))
    }
  }

  if (options?.signalCatalog) {
    const sigResult = validateSignalCatalog(options.signalCatalog)
    errors.push(...sigResult.errors)
    warnings.push(...sigResult.warnings)
  }

  return { valid: errors.length === 0, errors, warnings }
}

// ---------------------------------------------------------------------------
// Zod issue formatting
// ---------------------------------------------------------------------------

function formatZodIssues(issues: readonly z.ZodIssue[]): string[] {
  return issues.map(formatZodIssue)
}

function formatZodIssue(issue: z.ZodIssue): string {
  const path = formatPath(issue.path)
  return path.length === 0 ? issue.message : `${path}: ${issue.message}`
}

function formatPath(path: readonly (string | number)[]): string {
  if (path.length === 0) return ''
  let out = ''
  for (const seg of path) {
    if (typeof seg === 'number') {
      out += `[${String(seg)}]`
    } else {
      out += out.length === 0 ? seg : `.${seg}`
    }
  }
  return out
}

// ---------------------------------------------------------------------------
// Cross-field rules
// ---------------------------------------------------------------------------

function validateDefaultPageId(dashboard: z.infer<typeof DashboardConfigSchema>): string[] {
  const match = dashboard.pages.find((p) => p.id === dashboard.defaultPageId)
  if (match === undefined) {
    return [`defaultPageId "${dashboard.defaultPageId}" does not match any page id`]
  }
  if (match.visible === false) {
    return [`defaultPageId "${dashboard.defaultPageId}" refers to a page where visible is false`]
  }
  return []
}

function validatePageIdUniqueness(pages: readonly { id: string }[]): string[] {
  const seen = new Set<string>()
  const dupes = new Set<string>()
  for (const p of pages) {
    if (seen.has(p.id)) dupes.add(p.id)
    else seen.add(p.id)
  }
  return [...dupes].map((id) => `pages: duplicate page id "${id}"`)
}

function validateWidgetIdUniqueness(widgets: readonly { id: string }[], pageIdx: number): string[] {
  const seen = new Set<string>()
  const dupes = new Set<string>()
  for (const w of widgets) {
    if (seen.has(w.id)) dupes.add(w.id)
    else seen.add(w.id)
  }
  return [...dupes].map((id) => `pages[${String(pageIdx)}].widgets: duplicate widget id "${id}"`)
}

// ---------------------------------------------------------------------------
// Signal catalog cross-reference (warnings)
// ---------------------------------------------------------------------------

function collectSignalIds(
  rawConfig: unknown,
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

  // Legacy embedded fallback — `signals` is not part of DashboardConfigSchema,
  // so we read it off the raw input. `null` means "no catalog supplied".
  if (typeof rawConfig !== 'object' || rawConfig === null) return null
  const maybeSignals = (rawConfig as Record<string, unknown>).signals
  if (!Array.isArray(maybeSignals)) return null
  const ids = new Set<string>()
  for (const sig of maybeSignals) {
    if (typeof sig === 'object' && sig !== null) {
      const name = (sig as Record<string, unknown>).name
      if (typeof name === 'string') ids.add(name)
    }
  }
  return ids
}

function checkWidgetSignalRefs(
  pages: z.infer<typeof DashboardConfigSchema>['pages'],
  known: Set<string>
): string[] {
  const warnings: string[] = []
  pages.forEach((page, pageIdx) => {
    page.widgets.forEach((widget, widgetIdx) => {
      const signal = widget.signal
      if (signal.length > 0 && !known.has(signal)) {
        warnings.push(
          `pages[${String(pageIdx)}].widgets[${String(widgetIdx)}] references signal "${signal}" which is not defined in config.signals`
        )
      }
    })
  })
  return warnings
}

function checkTopBarSignalRefs(
  layout: NonNullable<z.infer<typeof DashboardConfigSchema>['topBar']['layout']>,
  known: Set<string>
): string[] {
  const warnings: string[] = []
  layout.forEach((item, idx) => {
    if (item.type !== 'statusDot' && item.type !== 'signal' && item.type !== 'modeFlag') return
    const signal = item.signal
    if (signal.length === 0) return
    if (signal === TOPBAR_LAYOUT_ANY_SIGNAL) return
    if (!known.has(signal)) {
      warnings.push(
        `topBar.layout[${String(idx)}] references signal "${signal}" which is not defined in config.signals`
      )
    }
  })
  return warnings
}
