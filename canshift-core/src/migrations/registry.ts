import {
  DEFAULT_PALETTE,
  STANDARD_WIDGET_TYPES,
  brightenHex,
  upgradeLegacySize,
} from './helpers.js'
import type { Migration } from './types.js'

export const MIGRATIONS: Migration[] = [
  {
    fromVersion: '1.22.0',
    toVersion: '1.23.0',
    migrate: (config) => {
      const pages = config.pages as Record<string, unknown>[] | undefined
      if (!Array.isArray(pages)) return { ...config, version: '1.23.0' }
      const migratedPages = pages.map((page) => {
        const widgets = page.widgets as Record<string, unknown>[] | undefined
        if (!Array.isArray(widgets)) return page
        const migratedWidgets = widgets.map((widget) => {
          if (widget.type !== 'button') return widget
          const cfg = widget.config as Record<string, unknown> | undefined
          if (!cfg) return widget
          if ('mode' in cfg) return widget
          return { ...widget, config: { ...cfg, mode: 'single' } }
        })
        return { ...page, widgets: migratedWidgets }
      })
      return { ...config, version: '1.23.0', pages: migratedPages }
    },
  },
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

export const BUILTIN_MIGRATIONS: readonly Migration[] = MIGRATIONS
