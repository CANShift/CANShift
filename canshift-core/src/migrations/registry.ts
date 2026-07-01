import {
  DEFAULT_PALETTE,
  STANDARD_WIDGET_TYPES,
  asObject,
  asObjectArray,
  brightenHex,
  clipField,
  flatMapWidgets,
  mapPages,
  mapWidgets,
  resizeWithinCanvas,
  upgradeLegacySize,
} from './helpers.js'
import type { Migration } from './types.js'

const CAPS_1_24 = {
  widgetLabel: 31,
  gaugePrefix: 7,
  prefixSuffix: 15,
  path: 63,
  protocol: 31,
} as const

export const MIGRATIONS: Migration[] = [
  {
    fromVersion: '1.23.0',
    toVersion: '1.24.0',
    migrate: (config) => {
      const migrated = mapWidgets(config, '1.24.0', (widget) => {
        const cfg = asObject(widget.config)
        if (!cfg) return widget
        switch (widget.type) {
          case 'gauge': {
            let next = { ...cfg }
            delete next.showNeedle
            next = clipField(next, 'prefix', CAPS_1_24.gaugePrefix)
            next = clipField(next, 'suffix', CAPS_1_24.prefixSuffix)
            return { ...widget, config: next }
          }
          case 'gear': {
            let next = clipField(cfg, 'prefix', CAPS_1_24.prefixSuffix)
            next = clipField(next, 'suffix', CAPS_1_24.prefixSuffix)
            return { ...widget, config: next }
          }
          case 'button': {
            let next = clipField(cfg, 'label', CAPS_1_24.widgetLabel)
            next = clipField(next, 'iconPath', CAPS_1_24.path)
            const states = asObjectArray(next.states)
            if (states) {
              next = {
                ...next,
                states: states.map((state) => clipField(state, 'label', CAPS_1_24.widgetLabel)),
              }
            }
            return { ...widget, config: next }
          }
          case 'image': {
            return { ...widget, config: clipField(cfg, 'imagePath', CAPS_1_24.path) }
          }
          default:
            return widget
        }
      })
      return typeof migrated.protocol === 'string'
        ? { ...migrated, protocol: migrated.protocol.slice(0, CAPS_1_24.protocol) }
        : migrated
    },
  },
  {
    fromVersion: '1.22.0',
    toVersion: '1.23.0',
    migrate: (config) =>
      flatMapWidgets(config, '1.23.0', (widget) => {
        if (widget.type !== 'button') return [widget]
        const cfg = asObject(widget.config)
        if (!cfg) return [widget]
        if (cfg.mode === 'cycle') return [widget]
        if (Array.isArray(cfg.actions) && cfg.actions.length === 0) return []
        if ('mode' in cfg) return [widget]
        return [{ ...widget, config: { ...cfg, mode: 'single' } }]
      }),
  },
  {
    fromVersion: '1.21.0',
    toVersion: '1.22.0',
    migrate: (config) =>
      mapWidgets(config, '1.22.0', (widget) => {
        if (widget.type === 'button') return widget
        const cfg = asObject(widget.config)
        if (!cfg) return widget
        if (!('label' in cfg) && !('labelPosition' in cfg)) return widget
        const rest = { ...cfg }
        delete rest.label
        delete rest.labelPosition
        return { ...widget, config: rest }
      }),
  },
  {
    fromVersion: '1.20.0',
    toVersion: '1.21.0',
    migrate: (config) =>
      flatMapWidgets(config, '1.21.0', (widget) => {
        if (widget.type === 'bar') return []
        if (widget.type !== 'gauge') return [widget]
        const cfg = asObject(widget.config)
        if (!cfg) return [widget]
        const hadBarStyle = cfg.displayStyle === 'bar'
        if (!hadBarStyle && !('barOrientation' in cfg)) return [widget]
        const rest = { ...cfg }
        delete rest.barOrientation
        if (hadBarStyle) rest.displayStyle = 'numeric'
        return [{ ...widget, config: rest }]
      }),
  },
  {
    fromVersion: '1.19.0',
    toVersion: '1.20.0',
    migrate: (config) =>
      mapWidgets(config, '1.20.0', (widget) => {
        const cfg = asObject(widget.config)
        if (!cfg || !('hideWhenInvalid' in cfg)) return widget
        const rest = { ...cfg }
        delete rest.hideWhenInvalid
        return { ...widget, config: rest }
      }),
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
    migrate: (config) =>
      mapWidgets(config, '1.17.0', (widget) => {
        const cfg = asObject(widget.config)
        if (!cfg) return widget
        if (!('warningLevel' in cfg)) return widget
        const { warningLevel: wl, ...rest } = cfg
        const newCfg =
          rest.dangerLevel === undefined && typeof wl === 'number'
            ? { ...rest, dangerLevel: wl }
            : rest
        return { ...widget, config: newCfg }
      }),
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
      const topBar = asObject(config.topBar)
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
    migrate: (config) =>
      mapWidgets(config, '1.9.0', (widget) => {
        const cfg = asObject(widget.config)
        const layout = asObject(widget.layout)
        if (!cfg || !layout) return widget
        if (cfg.displayStyle !== 'bar') return widget
        if (cfg.barOrientation !== 'horizontal') return widget
        if (layout.w !== 320 || layout.h !== 28) return widget
        return { ...widget, layout: resizeWithinCanvas(layout, 320, 56) }
      }),
  },
  {
    fromVersion: '1.7.0',
    toVersion: '1.8.0',
    migrate: (config) =>
      mapWidgets(config, '1.8.0', (widget) => {
        const type = widget.type
        const cfg = asObject(widget.config)
        if (!cfg) return widget

        if (type === 'button') {
          if (cfg.colors !== undefined) return widget
          const style = asObject(widget.style)
          const normal = typeof style?.primaryColor === 'string' ? style.primaryColor : '#FF4444'
          const active = brightenHex(normal)
          return { ...widget, config: { ...cfg, colors: { normal, active } } }
        }

        if (type === 'gauge' || type === 'bar') {
          if (!('iconName' in cfg)) return widget
          const rest = { ...cfg }
          delete rest.iconName
          return { ...widget, config: rest }
        }

        return widget
      }),
  },
  {
    fromVersion: '1.6.0',
    toVersion: '1.7.0',
    migrate: (config) => {
      const withPages = mapPages(config, '1.7.0', (page) => {
        const rest = { ...page }
        delete rest.name
        return rest
      })
      const topBar = asObject(config.topBar)
      if (!topBar) return withPages
      const rest = { ...topBar }
      delete rest.showMapName
      delete rest.showMapProfile
      return { ...withPages, topBar: rest }
    },
  },
  {
    fromVersion: '1.5.0',
    toVersion: '1.6.0',
    migrate: (config) =>
      mapWidgets(config, '1.6.0', (widget) => {
        const type = widget.type
        if (typeof type !== 'string' || !STANDARD_WIDGET_TYPES.has(type)) return widget

        const layout = asObject(widget.layout)
        if (!layout) return widget
        const w = layout.w
        const h = layout.h
        if (typeof w !== 'number' || typeof h !== 'number') return widget

        const upgraded = upgradeLegacySize(w, h)
        if (!upgraded) return widget

        return { ...widget, layout: resizeWithinCanvas(layout, upgraded.w, upgraded.h) }
      }),
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
    migrate: (config) =>
      mapPages(config, '1.3.0', (page) => {
        if (page.palette !== undefined) return page
        return { ...page, palette: { ...DEFAULT_PALETTE } }
      }),
  },
  {
    fromVersion: '1.1.0',
    toVersion: '1.2.0',
    migrate: (config) =>
      mapWidgets(config, '1.2.0', (widget) => {
        const cfg = asObject(widget.config)
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
      }),
  },
  {
    fromVersion: '1.0.0',
    toVersion: '1.1.0',
    migrate: (config) =>
      flatMapWidgets(config, '1.1.0', (widget) => {
        if (widget.type !== 'button') return [widget]
        const cfg = asObject(widget.config)
        if (!cfg) return [widget]
        if (Array.isArray(cfg.actions)) return cfg.actions.length > 0 ? [widget] : []

        const targetPageId = cfg.targetPageId
        if (typeof targetPageId !== 'string' || targetPageId.length === 0) return []

        const rest = { ...cfg }
        delete rest.targetPageId
        return [
          {
            ...widget,
            config: {
              ...rest,
              actions: [{ category: 'dashboard', type: 'navigate', pageId: targetPageId }],
            },
          },
        ]
      }),
  },
]

export const BUILTIN_MIGRATIONS: readonly Migration[] = MIGRATIONS
