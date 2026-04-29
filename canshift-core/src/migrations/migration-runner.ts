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

const MIGRATIONS: Migration[] = [
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

/**
 * Apply all migrations to bring config from its current version to targetVersion.
 * Returns the migrated config and the list of migrations applied.
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
