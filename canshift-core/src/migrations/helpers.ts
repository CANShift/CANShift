import { HEX_REGEX } from '../colors/hex.js'

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
