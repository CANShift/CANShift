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
// Append new migrations to the `BUILTIN_MIGRATIONS` array below as the
// schema evolves; the chain currently spans 1.0.0 → 1.19.0.

import { HEX_REGEX } from '../colors/hex.js'

export type MigrationFn = (config: Record<string, unknown>) => Record<string, unknown>

export interface Migration {
  fromVersion: string
  toVersion: string
  migrate: MigrationFn
}

// Deep-clone a JSON-shaped config via a JSON round-trip. Configs are pure
// JSON, so the round-trip is safe. We don't use `structuredClone` here to
// keep canshift-core's build dependency-free (no @types/node required).
//
// Wrapped so a caller passing an in-memory JS object that drifted from the
// JSON shape (a circular reference, an undefined value at the root) gets a
// typed boundary error rather than a raw `TypeError: Converting circular
// structure to JSON` bubbling out of `migrateConfig`. Audit C-LO-6.
function deepClone(value: Record<string, unknown>): Record<string, unknown> {
  try {
    return JSON.parse(JSON.stringify(value)) as Record<string, unknown>
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err)
    throw new Error(`Invalid config: not serializable to JSON (${reason})`, { cause: err })
  }
}

// ---------------------------------------------------------------------------
// Registered migrations (add new migrations here as schema evolves)
// ---------------------------------------------------------------------------
// Frozen snapshot of `DEFAULT_PAGE_PALETTE` (schemas/dashboard.ts) at the
// time the 1.2 → 1.3 migration shipped. Migrations must be deterministic:
// re-running the upgrade against the same legacy config must produce the
// same bytes today and in five years. That guarantee would break if we
// imported the live `DEFAULT_PAGE_PALETTE` here and a future palette
// refresh silently re-wrote every old config on the next load.
//
// Locked by a dedicated `1.2.0 → 1.3.0` test (see migration-runner.test.ts)
// — do NOT change the values without bumping the schema version and adding
// a fresh migration. Audit C-ME-3.
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

// Brighten a hex colour by adding `delta` to each channel (clamped to 0xFF).
// Used by the 1.7→1.8 migration to derive a button "active" colour from the
// pre-existing primaryColor — gives a contrasting hover shade by default.
function brightenHex(hex: string, delta = 0x33): string {
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

// All migrations receive a deep clone of the input — they can mutate freely;
// the caller's original object is never touched. See `migrateConfig` below.
const MIGRATIONS: Migration[] = [
  {
    // 1.18.0 → 1.19.0: BarWidgetConfig gains an optional `barOrientation` field
    // (#1232 flag from #1207 audit). Firmware (bar_widget.cpp) already
    // implements both horizontal and vertical render branches; the direct
    // `type:"bar"` schema previously locked the field out, forcing Studio's
    // bar preview to be horizontal-only. Existing configs leave the field
    // undefined and continue to render horizontally.
    fromVersion: '1.18.0',
    toVersion: '1.19.0',
    migrate: (config) => ({ ...config, version: '1.19.0' }),
  },
  {
    // 1.17.0 → 1.18.0: DashboardConfig gains an optional `targetProfile` field
    // (issue #548). No data transformation needed — existing configs leave the
    // field undefined and the read side (`resolveScreenProfile`) resolves
    // `undefined` to `DEFAULT_SCREEN_PROFILE_ID` ("crowpanel-28", 320×240).
    // This preserves byte-for-byte rendering of every pre-1.18 dashboard while
    // letting newly authored configs declare the panel they target.
    fromVersion: '1.17.0',
    toVersion: '1.18.0',
    migrate: (config) => ({ ...config, version: '1.18.0' }),
  },
  {
    // 1.16.0 → 1.17.0: collapse gauge / bar thresholds to a single field
    // (issue #965). The two-zone palette (#954) only needs one cut-off, so
    // `warningLevel` is dropped and `dangerLevel` becomes the sole threshold.
    // When only `warningLevel` was set (no `dangerLevel`), it is promoted to
    // `dangerLevel` so the threshold is not silently lost (#1171).
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
          // Promote sole warningLevel to dangerLevel so a gauge configured with
          // only a yellow zone doesn't silently lose its threshold (#1171).
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
    // 1.15.0 → 1.16.0: GaugeWidgetConfig and BarWidgetConfig gain an optional
    // `iconName` field (issue #954). When set to a known SensorIconName,
    // gauges fill opaquely in the per-sensor palette colour. Existing configs
    // leave the field undefined and keep the legacy `style.primaryColor` path.
    fromVersion: '1.15.0',
    toVersion: '1.16.0',
    migrate: (config) => ({ ...config, version: '1.16.0' }),
  },
  {
    // 1.14.0 → 1.15.0: WidgetStyle gains an optional `respectDayMode` field
    // (issue #191). No data transformation — existing widgets leave the field
    // undefined; firmware treats undefined as `true` to preserve the v0.7.0
    // contract from #171 (widgets follow the active day/night text colour).
    fromVersion: '1.14.0',
    toVersion: '1.15.0',
    migrate: (config) => ({ ...config, version: '1.15.0' }),
  },
  {
    // 1.13.0 → 1.14.0: signals.json `protocol` field migrated away from the
    // MaxxECU-specific identifier `"maxxecu_v1.2"` to the ECU-agnostic
    // `"custom_v1.0"` (issue #639, part of #556). The field is purely
    // informational — firmware reads it into `CfgSignalConfig.protocol` but
    // never branches on the value. Migration rewrites the legacy value when
    // present and is a no-op for dashboard configs (which have no `protocol`).
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
    // 1.12.0 → 1.13.0: SignalDef gains an optional `colorRamp` field
    // (issue #430). KEEP semantics — existing configs are bumped without any
    // data transformation. Signals without a ramp continue to render with the
    // legacy static color path. The firmware resolves a default ramp from the
    // signal name when none is configured.
    fromVersion: '1.12.0',
    toVersion: '1.13.0',
    migrate: (config) => ({ ...config, version: '1.13.0' }),
  },
  {
    // 1.11.0 → 1.12.0: default `topBar.height` bumped from 24 → 30 (issue #379).
    // Configs that explicitly persist the old default (`height === 24`) are
    // rewritten so users see the new, more legible bar without surprise. Any
    // other value (custom or already-bumped) is left untouched.
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
    // 1.10.0 → 1.11.0: arc gauges gain an optional `arcFillStyle` field
    // (issue #175). No data transformation needed — undefined defaults to
    // 'zones' on the read side, preserving legacy behaviour.
    fromVersion: '1.10.0',
    toVersion: '1.11.0',
    migrate: (config) => ({ ...config, version: '1.11.0' }),
  },
  {
    // 1.9.0 → 1.10.0: gauge / bar widgets gain an optional `alertThreshold`
    // field (issue #133). No data transformation needed — existing configs
    // simply leave the field undefined and the firmware does not flash.
    fromVersion: '1.9.0',
    toVersion: '1.10.0',
    migrate: (config) => ({ ...config, version: '1.10.0' }),
  },
  {
    // 1.8.0 → 1.9.0: H-FULL bar gauge token doubled from 320×28 to 320×56
    // (issue #134). Existing horizontal bar gauges sized 320×28 are upgraded
    // so the size picker keeps recognising them as H-FULL.
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
    // 1.7.0 → 1.8.0: button colours move to ButtonWidgetConfig.colors (issue #146).
    //   - For each button widget, set colors.normal = widget.style.primaryColor
    //     and colors.active = a brightened variant of normal.
    //   - Drop iconName from gauge and bar configs (icon picker is restricted to
    //     buttons and warnings only).
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
            // Skip if already migrated
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
 * The built-in migration registry shipped with this package. Exposed so that
 * consumers (and anchor tests) can verify the chain terminates at
 * `CURRENT_SCHEMA_VERSION`. Treated as read-only — do not mutate.
 */
export const BUILTIN_MIGRATIONS: readonly Migration[] = MIGRATIONS

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

// Semver pattern accepted by `migrateConfig` for `input.version`. Mirrors the
// regex used by `SemVerSchema` in `schemas/common.ts` — kept inline here so the
// migration runner stays free of cross-module coupling on a hot path. A change
// to either site should keep the two in sync (issue #1016, audit C-HI-2).
const SEMVER_PATTERN = /^\d+\.\d+\.\d+$/

/**
 * Apply all migrations to bring config from its current version to targetVersion.
 * Returns the migrated config and the list of migrations applied.
 *
 * The input is deep-cloned before any migration runs, so individual migrations
 * can mutate freely without aliasing the caller's object. Several existing
 * migrations only shallow-spread the top level (e.g. 1.3→1.4, 1.4→1.5,
 * 1.9→1.10) — the deep clone guarantees nested objects are not shared.
 *
 * Throws (with a precise message naming the defect) if:
 *   - `config` is null or not a plain object,
 *   - `config.version` is missing, not a string, empty, or not a semver triple.
 *
 * Strict input validation is required because callers in studio
 * (`useSessionRestore`, `useConfigActions`, `useDeviceConfigLoad`) cast raw
 * file contents via `as Record<string, unknown>` and rely on this function to
 * reject malformed payloads with an actionable message instead of producing
 * garbage downstream (audit C-HI-2, umbrella #1016).
 *
 * Throws if the migration chain has gaps — prevents partial migration.
 */
export function migrateConfig(
  config: Record<string, unknown>,
  targetVersion: string
): MigrationResult {
  // Strict input validation — the TS signature is bypassed by callers that
  // cast raw file contents (studio's `useSessionRestore`, `useConfigActions`,
  // `useDeviceConfigLoad` all do `rawContent as Record<string, unknown>`).
  // Without this guard, a number/empty/missing `version` would cast to
  // `string` and produce confusing downstream errors. Cast through `unknown`
  // here so the runtime guards are not optimised away by the type system.
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
