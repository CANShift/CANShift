import type { z } from 'zod'

import { DashboardConfigSchema } from '../schemas/dashboard.js'
import type { DashboardConfig } from '../schemas/dashboard.js'
import { ColorRampSchema } from '../schemas/signal.js'
import type { SignalConfig } from '../schemas/signal.js'

export interface ValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
  config?: DashboardConfig
}

export interface ValidateDashboardOptions {
  signalCatalog?: SignalConfig
}

const TOPBAR_LAYOUT_ANY_SIGNAL = 'any'

const formatPath = (path: readonly (string | number)[]): string => {
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

const formatZodIssue = (issue: z.ZodIssue): string => {
  const path = formatPath(issue.path)
  return path.length === 0 ? issue.message : `${path}: ${issue.message}`
}

const formatZodIssues = (issues: readonly z.ZodIssue[]): string[] => issues.map(formatZodIssue)

const validateSignalCatalogIssues = (catalog: SignalConfig): string[] => {
  const errors: string[] = []
  catalog.signals.forEach((signal, idx) => {
    const ramp = signal.colorRamp
    if (!ramp) return
    const result = ColorRampSchema.safeParse(ramp)
    if (result.success) return
    const prefix = `signals[${idx.toString()}] (${signal.name}).colorRamp`
    for (const issue of result.error.issues) {
      const subPath = formatPath(issue.path)
      errors.push(
        subPath.length === 0
          ? `${prefix}: ${issue.message}`
          : `${prefix}.${subPath}: ${issue.message}`
      )
    }
  })
  return errors
}

const validateDefaultPageId = (dashboard: z.infer<typeof DashboardConfigSchema>): string[] => {
  const match = dashboard.pages.find((p) => p.id === dashboard.defaultPageId)
  if (match === undefined) {
    return [`defaultPageId "${dashboard.defaultPageId}" does not match any page id`]
  }
  if (match.visible === false) {
    return [`defaultPageId "${dashboard.defaultPageId}" refers to a page where visible is false`]
  }
  return []
}

const validatePageIdUniqueness = (pages: readonly { id: string }[]): string[] => {
  const seen = new Set<string>()
  const dupes = new Set<string>()
  for (const p of pages) {
    if (seen.has(p.id)) dupes.add(p.id)
    else seen.add(p.id)
  }
  return [...dupes].map((id) => `pages: duplicate page id "${id}"`)
}

const validateWidgetIdUniqueness = (
  widgets: readonly { id: string }[],
  pageIdx: number
): string[] => {
  const seen = new Set<string>()
  const dupes = new Set<string>()
  for (const w of widgets) {
    if (seen.has(w.id)) dupes.add(w.id)
    else seen.add(w.id)
  }
  return [...dupes].map((id) => `pages[${String(pageIdx)}].widgets: duplicate widget id "${id}"`)
}

const collectSignalIds = (
  rawConfig: unknown,
  signalCatalog: SignalConfig | undefined
): Set<string> | null => {
  if (signalCatalog && Array.isArray(signalCatalog.signals)) {
    const ids = new Set<string>()
    for (const sig of signalCatalog.signals) {
      if (typeof sig.name === 'string') ids.add(sig.name)
    }
    return ids
  }

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

const checkWidgetSignalRefs = (
  pages: z.infer<typeof DashboardConfigSchema>['pages'],
  known: Set<string>
): string[] => {
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

const checkTopBarSignalRefs = (
  layout: NonNullable<z.infer<typeof DashboardConfigSchema>['topBar']['layout']>,
  known: Set<string>
): string[] => {
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

export const validateDashboard = (
  config: unknown,
  options?: ValidateDashboardOptions
): ValidationResult => {
  const errors: string[] = []
  const warnings: string[] = []

  const parsed = DashboardConfigSchema.safeParse(config)

  if (!parsed.success) {
    errors.push(...formatZodIssues(parsed.error.issues))
    if (options?.signalCatalog) {
      errors.push(...validateSignalCatalogIssues(options.signalCatalog))
    }
    return { valid: false, errors, warnings }
  }

  const dashboard = parsed.data

  errors.push(...validateDefaultPageId(dashboard))
  errors.push(...validatePageIdUniqueness(dashboard.pages))
  dashboard.pages.forEach((page, idx) => {
    errors.push(...validateWidgetIdUniqueness(page.widgets, idx))
  })

  const knownSignalIds = collectSignalIds(config, options?.signalCatalog)
  if (knownSignalIds !== null) {
    warnings.push(...checkWidgetSignalRefs(dashboard.pages, knownSignalIds))
    if (dashboard.topBar.layout) {
      warnings.push(...checkTopBarSignalRefs(dashboard.topBar.layout, knownSignalIds))
    }
  }

  if (options?.signalCatalog) {
    errors.push(...validateSignalCatalogIssues(options.signalCatalog))
  }

  return errors.length === 0
    ? { valid: true, errors, warnings, config: dashboard as DashboardConfig }
    : { valid: false, errors, warnings }
}
