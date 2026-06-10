import { HEX_REGEX } from '../colors/hex.js'

export type MigrationFn = (config: Record<string, unknown>) => Record<string, unknown>

export interface Migration {
  fromVersion: string
  toVersion: string
  migrate: MigrationFn
}

const deepClone = (value: Record<string, unknown>): Record<string, unknown> => {
  try {
    return JSON.parse(JSON.stringify(value)) as Record<string, unknown>
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err)
    throw new Error(`Invalid config: not serializable to JSON (${reason})`, { cause: err })
  }
}

const DEFAULT_PALETTE = {
  surface: '#1E1E1E',
  primary: '#FF4444',
  accent: '#FF8800',
  text: '#FFFFFF',
  textDim: '#888888',
  warning: '#FF8800',
  danger: '#FF4444',
  success: '#00CC44',
} as const

const STANDARD_WIDGET_TYPES = new Set(['button', 'warning', 'gear', 'timer', 'image'])

const upgradeLegacySize = (w: number, h: number): { w: number; h: number } | null =>
  w === 80 && (h === 28 || h === 56 || h === 112) ? { w: 160, h: 56 } : null

const brightenHex = (hex: string, delta = 0x33): string => {
  const m = HEX_REGEX.exec(hex)
  if (!m) return hex
  const value = m[1]
  if (!value) return hex
  const channels = [0, 2, 4].map((i) => {
    const c = parseInt(value.substring(i, i + 2), 16)
    return Math.min(0xff, c + delta)
      .toString(16)
      .padStart(2, '0')
  })
  return `#${channels.join('').toUpperCase()}`
}

const MIGRATIONS: Migration[] = [
  {
    fromVersion: '1.21.0',
    toVersion: '1.22.0',
    migrate: (config) => {
      const pages = config.pages as Record<string, unknown>[] | undefined
      if (!Array.isArray(pages)) return { ...config, version: '1.22.0' }
      const migratedPages = pages.map((page) => {
        const widgets = page.widgets as Record<string, unknown>[] | undefined
        if (!Array.isArray(widgets)) return page
        const migratedWidgets = widgets.map((widget) => {
          if (widget.type === 'button') return widget
          const cfg = widget.config as Record<string, unknown> | undefined
          if (!cfg) return widget
          if (!('label' in cfg) && !('labelPosition' in cfg)) return widget
          const rest = { ...cfg }
          delete rest.label
          delete rest.labelPosition
          return { ...widget, config: rest }
        })
        return { ...page, widgets: migratedWidgets }
      })
      return { ...config, version: '1.22.0', pages: migratedPages }
    },
  },
  {
    fromVersion: '1.20.0',
    toVersion: '1.21.0',
    migrate: (config) => {
      const pages = config.pages as Record<string, unknown>[] | undefined
      if (!Array.isArray(pages)) return { ...config, version: '1.21.0' }
      const migratedPages = pages.map((page) => {
        const widgets = page.widgets as Record<string, unknown>[] | undefined
        if (!Array.isArray(widgets)) return page
        const filtered = widgets
          .filter((w) => w.type !== 'bar')
          .map((widget) => {
            if (widget.type !== 'gauge') return widget
            const cfg = widget.config as Record<string, unknown> | undefined
            if (!cfg || !('barOrientation' in cfg)) return widget
            const rest = { ...cfg }
            delete rest.barOrientation
            return { ...widget, config: rest }
          })
        return { ...page, widgets: filtered }
      })
      return { ...config, version: '1.21.0', pages: migratedPages }
    },
  },
  {
    fromVersion: '1.19.0',
    toVersion: '1.20.0',
    migrate: (config) => {
      const pages = config.pages as Record<string, unknown>[] | undefined
      if (!Array.isArray(pages)) return { ...config, version: '1.20.0' }
      const migratedPages = pages.map((page) => {
        const widgets = page.widgets as Record<string, unknown>[] | undefined
        if (!Array.isArray(widgets)) return page
        const migratedWidgets = widgets.map((widget) => {
          const cfg = widget.config as Record<string, unknown> | undefined
          if (!cfg || !('hideWhenInvalid' in cfg)) return widget
          const rest = { ...cfg }
          delete rest.hideWhenInvalid
          return { ...widget, config: rest }
        })
        return { ...page, widgets: migratedWidgets }
      })
      return { ...config, version: '1.20.0', pages: migratedPages }
    },
  },
  {
    fromVersion: '1.18.0',
    toVersion: '1.19.0',
    migrate: (config) => ({ ...config, version: '1.19.0' }),
  },
  {
    fromVersion: '1.17.0',
    toVersion: '1.18.0',
    migrate: (config) => ({ ...config, version: '1.18.0' }),
  },
  {
    fromVersion: '1.16.0',
    toVersion: '1.17.0',
    migrate: (config) => {
      const pages = config.pages as Record<string, unknown>[] | undefined
      if (!Array.isArray(pages)) return { ...config, version: '1.17.0' }
      const migratedPages = pages.map((page) => {
        const widgets = page.widgets as Record<string, unknown>[] | undefined
        if (!Array.isArray(widgets)) return page
        const migratedWidgets = widgets.map((widget) => {
          const cfg = widget.config as Record<string, unknown> | undefined
          if (!cfg) return widget
          if (!('warningLevel' in cfg)) return widget
          const { warningLevel: wl, ...rest } = cfg
          const newCfg =
            rest.dangerLevel === undefined && typeof wl === 'number'
              ? { ...rest, dangerLevel: wl }
              : rest
          return { ...widget, config: newCfg }
        })
        return { ...page, widgets: migratedWidgets }
      })
      return { ...config, version: '1.17.0', pages: migratedPages }
    },
  },
  {
    fromVersion: '1.15.0',
    toVersion: '1.16.0',
    migrate: (config) => ({ ...config, version: '1.16.0' }),
  },
  {
    fromVersion: '1.14.0',
    toVersion: '1.15.0',
    migrate: (config) => ({ ...config, version: '1.15.0' }),
  },
  {
    fromVersion: '1.13.0',
    toVersion: '1.14.0',
    migrate: (config) => {
      if (config.protocol === 'maxxecu_v1.2') {
        return { ...config, version: '1.14.0', protocol: 'custom_v1.0' }
      }
      return { ...config, version: '1.14.0' }
    },
  },
  {
    fromVersion: '1.12.0',
    toVersion: '1.13.0',
    migrate: (config) => ({ ...config, version: '1.13.0' }),
  },
  {
    fromVersion: '1.11.0',
    toVersion: '1.12.0',
    migrate: (config) => {
      const topBar = config.topBar as Record<string, unknown> | undefined
      if (topBar?.height !== 24) {
        return { ...config, version: '1.12.0' }
      }
      return { ...config, version: '1.12.0', topBar: { ...topBar, height: 30 } }
    },
  },
  {
    fromVersion: '1.10.0',
    toVersion: '1.11.0',
    migrate: (config) => ({ ...config, version: '1.11.0' }),
  },
  {
    fromVersion: '1.9.0',
    toVersion: '1.10.0',
    migrate: (config) => ({ ...config, version: '1.10.0' }),
  },
  {
    fromVersion: '1.8.0',
    toVersion: '1.9.0',
    migrate: (config) => {
      const pages = config.pages as Record<string, unknown>[] | undefined
      if (!Array.isArray(pages)) return { ...config, version: '1.9.0' }

      const migratedPages = pages.map((page) => {
        const widgets = page.widgets as Record<string, unknown>[] | undefined
        if (!Array.isArray(widgets)) return page

        const migratedWidgets = widgets.map((widget) => {
          const cfg = widget.config as Record<string, unknown> | undefined
          const layout = widget.layout as Record<string, unknown> | undefined
          if (!cfg || !layout) return widget
          if (cfg.displayStyle !== 'bar') return widget
          if (cfg.barOrientation !== 'horizontal') return widget
          if (layout.w !== 320 || layout.h !== 28) return widget
          return { ...widget, layout: { ...layout, h: 56 } }
        })

        return { ...page, widgets: migratedWidgets }
      })

      return { ...config, version: '1.9.0', pages: migratedPages }
    },
  },
  {
    fromVersion: '1.7.0',
    toVersion: '1.8.0',
    migrate: (config) => {
      const pages = config.pages as Record<string, unknown>[] | undefined
      if (!Array.isArray(pages)) return { ...config, version: '1.8.0' }

      const migratedPages = pages.map((page) => {
        const widgets = page.widgets as Record<string, unknown>[] | undefined
        if (!Array.isArray(widgets)) return page

        const migratedWidgets = widgets.map((widget) => {
          const type = widget.type as string | undefined
          const cfg = widget.config as Record<string, unknown> | undefined
          if (!cfg) return widget

          if (type === 'button') {
            if (cfg.colors !== undefined) return widget
            const style = widget.style as Record<string, unknown> | undefined
            const normalRaw =
              typeof style?.primaryColor === 'string' ? style.primaryColor : '#FF4444'
            const normal = normalRaw
            const active = brightenHex(normal)
            return {
              ...widget,
              config: { ...cfg, colors: { normal, active } },
            }
          }

          if (type === 'gauge' || type === 'bar') {
            if (!('iconName' in cfg)) return widget
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const { iconName: _iconName, ...rest } = cfg
            return { ...widget, config: rest }
          }

          return widget
        })

        return { ...page, widgets: migratedWidgets }
      })

      return { ...config, version: '1.8.0', pages: migratedPages }
    },
  },
  {
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
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { showMapName: _showMapName, showMapProfile: _showMapProfile, ...rest } = topBar
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
    fromVersion: '1.4.0',
    toVersion: '1.5.0',
    migrate: (config) => ({ ...config, version: '1.5.0' }),
  },
  {
    fromVersion: '1.3.0',
    toVersion: '1.4.0',
    migrate: (config) => ({ ...config, version: '1.4.0' }),
  },
  {
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

          if (Array.isArray(cfg.actions)) return widget

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
  applied: string[]
}

export type MigrationRegistry = Migration[]

export const BUILTIN_MIGRATIONS: readonly Migration[] = MIGRATIONS

const SEMVER_PATTERN = /^\d+\.\d+\.\d+$/

const parseSemverTuple = (version: string): [number, number, number] => {
  const parts = version.split('.').map((p) => Number.parseInt(p, 10))
  return [parts[0] ?? 0, parts[1] ?? 0, parts[2] ?? 0]
}

const isSemverGreater = (a: string, b: string): boolean => {
  const [aMajor, aMinor, aPatch] = parseSemverTuple(a)
  const [bMajor, bMinor, bPatch] = parseSemverTuple(b)
  if (aMajor !== bMajor) return aMajor > bMajor
  if (aMinor !== bMinor) return aMinor > bMinor
  return aPatch > bPatch
}

export const validateMigrationChain = (
  fromVersion: string,
  toVersion: string,
  registry: MigrationRegistry
): string[] => {
  if (
    SEMVER_PATTERN.test(fromVersion) &&
    SEMVER_PATTERN.test(toVersion) &&
    isSemverGreater(fromVersion, toVersion)
  ) {
    throw new Error(`downgrade not supported: ${fromVersion} → ${toVersion}`)
  }

  const missing: string[] = []
  let current = fromVersion

  while (current !== toVersion) {
    const next = registry.find((m) => m.fromVersion === current)
    if (!next) {
      missing.push(`${current}→${toVersion}`)
      break
    }
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

const buildMigrationChain = (fromVersion: string, toVersion: string): Migration[] => {
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

export const migrateConfig = (
  config: Record<string, unknown>,
  targetVersion: string
): MigrationResult => {
  const rawConfig = config as unknown
  if (rawConfig === null || typeof rawConfig !== 'object' || Array.isArray(rawConfig)) {
    throw new Error('migrateConfig: input must be a non-null object')
  }
  const rawVersion: unknown = (rawConfig as Record<string, unknown>).version
  if (typeof rawVersion !== 'string') {
    throw new Error(
      `migrateConfig: input.version is not a string (got ${rawVersion === null ? 'null' : typeof rawVersion})`
    )
  }
  if (rawVersion.length === 0) {
    throw new Error('migrateConfig: input.version is an empty string')
  }
  if (!SEMVER_PATTERN.test(rawVersion)) {
    throw new Error(
      `migrateConfig: input.version "${rawVersion}" does not match semver pattern "MAJOR.MINOR.PATCH"`
    )
  }
  const currentVersion = rawVersion
  let current = deepClone(config)
  const applied: string[] = []

  if (currentVersion === targetVersion) {
    return { config: current, applied }
  }

  if (SEMVER_PATTERN.test(targetVersion) && isSemverGreater(currentVersion, targetVersion)) {
    throw new Error(`downgrade not supported: ${currentVersion} → ${targetVersion}`)
  }

  const missing = validateMigrationChain(currentVersion, targetVersion, MIGRATIONS)
  if (missing.length > 0) {
    throw new Error(`Migration chain incomplete: missing steps [${missing.join(', ')}]`)
  }

  const chain = buildMigrationChain(currentVersion, targetVersion)

  for (const migration of chain) {
    current = migration.migrate(current)
    applied.push(`${migration.fromVersion} → ${migration.toVersion}`)
  }

  return { config: current, applied }
}
