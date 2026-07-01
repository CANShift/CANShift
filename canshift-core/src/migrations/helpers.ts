import { HEX_REGEX } from '../colors/hex.js'
import { CANVAS } from '../constants/firmware-caps.js'

type Config = Record<string, unknown>

export const asObject = (value: unknown): Config | undefined =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Config)
    : undefined

export const asObjectArray = (value: unknown): Config[] | undefined =>
  Array.isArray(value) ? (value as Config[]) : undefined

export const mapPages = (config: Config, version: string, fn: (page: Config) => Config): Config => {
  const pages = asObjectArray(config.pages)
  if (!pages) return { ...config, version }
  return { ...config, version, pages: pages.map(fn) }
}

export const mapWidgets = (
  config: Config,
  version: string,
  fn: (widget: Config) => Config
): Config =>
  mapPages(config, version, (page) => {
    const widgets = asObjectArray(page.widgets)
    if (!widgets) return page
    return { ...page, widgets: widgets.map(fn) }
  })

export const flatMapWidgets = (
  config: Config,
  version: string,
  fn: (widget: Config) => Config[]
): Config =>
  mapPages(config, version, (page) => {
    const widgets = asObjectArray(page.widgets)
    if (!widgets) return page
    return { ...page, widgets: widgets.flatMap(fn) }
  })

export const resizeWithinCanvas = (layout: Config, w: number, h: number): Config => {
  const x =
    typeof layout.x === 'number' ? Math.max(0, Math.min(layout.x, CANVAS.WIDTH - w)) : layout.x
  const y =
    typeof layout.y === 'number' ? Math.max(0, Math.min(layout.y, CANVAS.HEIGHT - h)) : layout.y
  return { ...layout, x, y, w, h }
}

export const deepClone = (value: Record<string, unknown>): Record<string, unknown> => {
  try {
    return JSON.parse(JSON.stringify(value)) as Record<string, unknown>
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err)
    throw new Error(`Invalid config: not serializable to JSON (${reason})`, { cause: err })
  }
}

export const DEFAULT_PALETTE = {
  surface: '#1E1E1E',
  primary: '#FF4444',
  accent: '#FF8800',
  text: '#FFFFFF',
  textDim: '#888888',
  warning: '#FF8800',
  danger: '#FF4444',
  success: '#00CC44',
} as const

export const STANDARD_WIDGET_TYPES = new Set(['button', 'warning', 'gear', 'timer', 'image'])

export const upgradeLegacySize = (w: number, h: number): { w: number; h: number } | null =>
  w === 80 && (h === 28 || h === 56 || h === 112) ? { w: 160, h: 56 } : null

export const clipField = (obj: Config, key: string, max: number): Config => {
  const value = obj[key]
  return typeof value === 'string' && value.length > max
    ? { ...obj, [key]: value.slice(0, max) }
    : obj
}

export const brightenHex = (hex: string, delta = 0x33): string => {
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
