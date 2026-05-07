// migration-runner.ts — Schema version migration framework
//
// When a config file has an older schema version, apply the migration chain
// to bring it up to the current version.
//
// Migration strategy:
//   - Each migration is a pure function: (oldConfig) => newConfig
//   - Migrations are chained: 1.0.0 → 1.1.0 → 1.2.0 etc.
//   - The runner applies all migrations between the file version and current version
//
// TODO: Add actual migration implementations as schema evolves.

export type MigrationFn = (config: Record<string, unknown>) => Record<string, unknown>

interface Migration {
  fromVersion: string
  toVersion: string
  migrate: MigrationFn
}

// ---------------------------------------------------------------------------
// Registered migrations (add new migrations here as schema evolves)
// ---------------------------------------------------------------------------
const DEFAULT_PALETTE = {
  surface: '#1E1E1E',
  primary: '#FF4444',
  accent: '#FF8800',
  text: '#FFFFFF',
  textDim: '#888888',
  warning: '#FF8800',
  danger: '#FF4444',
  success: '#00CC44',
}

// Standard widget types that follow the L/XL size scale (issue #131).
// Bar gauges keep their own narrow tokens — never resize them here.
const STANDARD_WIDGET_TYPES = new Set(['button', 'warning', 'gear', 'timer', 'image'])

// Closest remaining size for legacy small dimensions. All small tokens collapse
// to L (160×56) — the smallest size that survives 1.6.0.
function upgradeLegacySize(w: number, h: number): { w: number; h: number } | null {
  // XS = 80×28, S = 80×56, M = 80×112 — collapse to L
  if (w === 80 && (h === 28 || h === 56 || h === 112)) {
    return { w: 160, h: 56 }
  }
  return null
}

const MIGRATIONS: Migration[] = [
  {
    // 1.6.0 → 1.7.0: drop unused page-level fields (issue #142).
    //   PageConfig.name → silently dropped (no per-page title in studio anymore)
    //   TopBarConfig.showMapName / showMapProfile → silently dropped
    fromVersion: '1.6.0',
    toVersion: '1.7.0',
    migrate: (config) => {
      const pages = config.pages as Record<string, unknown>[] | undefined
      const migratedPages = Array.isArray(pages)
        ? pages.map((page) => {
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const { name: _name, ...rest } = page
            return rest
          })
        : pages

      const topBar = config.topBar as Record<string, unknown> | undefined
      let migratedTopBar = topBar
      if (topBar) {
        const {
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          showMapName: _showMapName,
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          showMapProfile: _showMapProfile,
          ...rest
        } = topBar
        migratedTopBar = rest
      }

      return {
        ...config,
        version: '1.7.0',
        ...(migratedPages !== undefined && { pages: migratedPages }),
        ...(migratedTopBar !== undefined && { topBar: migratedTopBar }),
      }
    },
  },
  {
    // 1.5.0 → 1.6.0: drop XS / S / M widget sizes (issue #131).
    // Any standard widget (button, warning, gear, timer, image) sized 80×28,
    // 80×56, or 80×112 is upgraded to L (160×56) — the closest remaining size.
    // Gauge widgets keep their bar-specific narrow tokens (V-M, V).
    fromVersion: '1.5.0',
    toVersion: '1.6.0',
    migrate: (config) => {
      const pages = config.pages as Record<string, unknown>[] | undefined
      if (!Array.isArray(pages)) return { ...config, version: '1.6.0' }

      const migratedPages = pages.map((page) => {
        const widgets = page.widgets as Record<string, unknown>[] | undefined
        if (!Array.isArray(widgets)) return page

        const migratedWidgets = widgets.map((widget) => {
          const type = widget.type as string | undefined
          if (!type || !STANDARD_WIDGET_TYPES.has(type)) return widget

          const layout = widget.layout as Record<string, unknown> | undefined
          const w = layout?.w
          const h = layout?.h
          if (typeof w !== 'number' || typeof h !== 'number') return widget

          const upgraded = upgradeLegacySize(w, h)
          if (!upgraded) return widget

          return { ...widget, layout: { ...layout, w: upgraded.w, h: upgraded.h } }
        })

        return { ...page, widgets: migratedWidgets }
      })

      return { ...config, version: '1.6.0', pages: migratedPages }
    },
  },
  {
    // 1.4.0 → 1.5.0: TopBarConfig gains an optional `layout` field.
    // When absent, both firmware and studio preview fall back to the default
    // layout — no data transformation needed.
    fromVersion: '1.4.0',
    toVersion: '1.5.0',
    migrate: (config) => ({ ...config, version: '1.5.0' }),
  },
  {
    // 1.3.0 → 1.4.0: DashboardConfig gains an optional `dayTheme` field.
    // No data transformation needed — existing configs remain valid as-is.
    fromVersion: '1.3.0',
    toVersion: '1.4.0',
    migrate: (config) => ({ ...config, version: '1.4.0' }),
  },
  {
    // 1.2.0 → 1.3.0: PageConfig gains a `palette` field.
    // Pages without one get the default CANShift palette.
    fromVersion: '1.2.0',
    toVersion: '1.3.0',
    migrate: (config) => {
      const pages = config.pages as Record<string, unknown>[] | undefined
      if (!Array.isArray(pages)) return { ...config, version: '1.3.0' }

      const migratedPages = pages.map((page) => {
        if (page.palette !== undefined) return page
        return { ...page, palette: { ...DEFAULT_PALETTE } }
      })

      return { ...config, version: '1.3.0', pages: migratedPages }
    },
  },
  {
    // 1.1.0 → 1.2.0: LabelWidgetConfig removed; merged into GaugeWidgetConfig.
    //   label widgets → gauge { displayStyle: 'numeric', minValue: 0, maxValue: 100, ... }
    //   gauge widgets without displayStyle → gauge { displayStyle: 'arc' }
    fromVersion: '1.1.0',
    toVersion: '1.2.0',
    migrate: (config) => {
      const pages = config.pages as Record<string, unknown>[] | undefined
      if (!Array.isArray(pages)) return { ...config, version: '1.2.0' }

      const migratedPages = pages.map((page) => {
        const widgets = page.widgets as Record<string, unknown>[] | undefined
        if (!Array.isArray(widgets)) return page

        const migratedWidgets = widgets.map((widget) => {
          const cfg = widget.config as Record<string, unknown> | undefined
          if (!cfg) return widget

          if (widget.type === 'label') {
            return {
              ...widget,
              type: 'gauge',
              config: {
                type: 'gauge',
                displayStyle: 'numeric',
                minValue: 0,
                maxValue: 100,
                warningLevel: 80,
                dangerLevel: 95,
                decimalPlaces: (cfg.decimalPlaces as number | undefined) ?? 0,
                ...(cfg.prefix !== undefined && { prefix: cfg.prefix }),
                ...(cfg.suffix !== undefined && { suffix: cfg.suffix }),
                ...(cfg.hideWhenInvalid !== undefined && { hideWhenInvalid: cfg.hideWhenInvalid }),
                ...(cfg.iconName !== undefined && { iconName: cfg.iconName }),
              },
            }
          }

          if (widget.type === 'gauge' && !cfg.displayStyle) {
            return {
              ...widget,
              config: {
                ...cfg,
                type: 'gauge',
                displayStyle: 'arc',
                decimalPlaces: (cfg.decimalPlaces as number | undefined) ?? 0,
              },
            }
          }

          return widget
        })

        return { ...page, widgets: migratedWidgets }
      })

      return { ...config, version: '1.2.0', pages: migratedPages }
    },
  },
  {
    // 1.0.0 → 1.1.0: ButtonWidgetConfig.targetPageId replaced by actions array.
    // Each button with a targetPageId becomes a single 'navigate' action.
    fromVersion: '1.0.0',
    toVersion: '1.1.0',
    migrate: (config) => {
      const pages = config.pages as Record<string, unknown>[] | undefined
      if (!Array.isArray(pages)) return { ...config, version: '1.1.0' }

      const migratedPages = pages.map((page) => {
        const widgets = page.widgets as Record<string, unknown>[] | undefined
        if (!Array.isArray(widgets)) return page

        const migratedWidgets = widgets.map((widget) => {
          if (widget.type !== 'button') return widget
          const cfg = widget.config as Record<string, unknown> | undefined
          if (!cfg) return widget

          // If already using actions[], leave it alone
          if (Array.isArray(cfg.actions)) return widget

          // Migrate targetPageId → navigate action
          const targetPageId = cfg.targetPageId as string | undefined
          const actions = targetPageId
            ? [{ category: 'dashboard', type: 'navigate', pageId: targetPageId }]
            : []

          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { targetPageId: _, ...restCfg } = cfg
          return { ...widget, config: { ...restCfg, actions } }
        })

        return { ...page, widgets: migratedWidgets }
      })

      return { ...config, version: '1.1.0', pages: migratedPages }
    },
  },
]

export interface MigrationResult {
  config: Record<string, unknown>
  applied: string[] // List of migration steps applied
}

/** A registry of available migrations, keyed by fromVersion. */
export type MigrationRegistry = Migration[]

/**
 * Validates that a complete migration chain exists from fromVersion to toVersion.
 * Returns an array of missing step strings (e.g. ["1.2.0→1.3.0"]).
 * An empty array means the chain is complete.
 */
export function validateMigrationChain(
  fromVersion: string,
  toVersion: string,
  registry: MigrationRegistry
): string[] {
  const missing: string[] = []
  let current = fromVersion

  while (current !== toVersion) {
    const next = registry.find((m) => m.fromVersion === current)
    if (!next) {
      // Determine what the expected next version would be for a useful message
      missing.push(`${current}→${toVersion}`)
      break
    }
    // Check the migration step explicitly exists
    const stepExists = registry.some(
      (m) => m.fromVersion === current && m.toVersion === next.toVersion
    )
    if (!stepExists) {
      missing.push(`${current}→${next.toVersion}`)
    }
    current = next.toVersion
  }

  return missing
}

/**
 * Apply all migrations to bring config from its current version to targetVersion.
 * Returns the migrated config and the list of migrations applied.
 *
 * Throws if the migration chain has gaps — prevents partial migration.
 */
export function migrateConfig(
  config: Record<string, unknown>,
  targetVersion: string
): MigrationResult {
  const currentVersion = (config.version as string | undefined) ?? '0.0.0'
  let current = { ...config }
  const applied: string[] = []

  if (currentVersion === targetVersion) {
    return { config: current, applied }
  }

  // Validate the chain is complete before applying any migration
  const missing = validateMigrationChain(currentVersion, targetVersion, MIGRATIONS)
  if (missing.length > 0) {
    throw new Error(`Migration chain incomplete: missing steps [${missing.join(', ')}]`)
  }

  // Find applicable migrations in order
  const chain = buildMigrationChain(currentVersion, targetVersion)

  for (const migration of chain) {
    current = migration.migrate(current)
    applied.push(`${migration.fromVersion} → ${migration.toVersion}`)
  }

  return { config: current, applied }
}

function buildMigrationChain(fromVersion: string, toVersion: string): Migration[] {
  // Simple linear chain — find migrations that connect fromVersion to toVersion
  const chain: Migration[] = []
  let current = fromVersion

  while (current !== toVersion) {
    const next = MIGRATIONS.find((m) => m.fromVersion === current)
    if (!next) {
      throw new Error(
        `No migration path from ${current} to ${toVersion}. ` +
          `Available migrations: ${MIGRATIONS.map((m) => `${m.fromVersion}→${m.toVersion}`).join(', ')}`
      )
    }
    chain.push(next)
    current = next.toVersion
  }

  return chain
}
