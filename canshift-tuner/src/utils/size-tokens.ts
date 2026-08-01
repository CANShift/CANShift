import type { GaugeDisplayStyle } from '@tmbk/canshift-core'

export type SizeTokenId = 'XXL' | 'XL' | 'L' | 'H-XL' | 'H-FULL' | 'V' | 'V-M'

export interface SizeToken {
  id: SizeTokenId
  label: string
  description: string
  colSpan: number
  rowSpan: number
}

export const SIZE_TOKENS: Record<SizeTokenId, SizeToken> = {
  XXL: { id: 'XXL', label: 'XXL', description: '6×12', colSpan: 6, rowSpan: 12 },
  XL: { id: 'XL', label: 'XL', description: '6×6', colSpan: 6, rowSpan: 6 },
  L: { id: 'L', label: 'L', description: '6×3', colSpan: 6, rowSpan: 3 },
  'H-XL': { id: 'H-XL', label: 'H↔ XL', description: '12×6', colSpan: 12, rowSpan: 6 },
  'H-FULL': { id: 'H-FULL', label: 'H↔', description: '12×3', colSpan: 12, rowSpan: 3 },
  V: { id: 'V', label: 'V↕', description: '2×12', colSpan: 2, rowSpan: 12 },
  'V-M': { id: 'V-M', label: 'V-M', description: '2×6', colSpan: 2, rowSpan: 6 },
}

export const SIZE_TOKEN_LIST: SizeToken[] = Object.values(SIZE_TOKENS)

export const tokenFromSpans = (colSpan: number, rowSpan: number): SizeTokenId | null =>
  SIZE_TOKEN_LIST.find((t) => t.colSpan === colSpan && t.rowSpan === rowSpan)?.id ?? null

export const gaugeTokenIds = (displayStyle: GaugeDisplayStyle): SizeTokenId[] => {
  if (displayStyle === 'arc') return ['XL', 'XXL']
  return ['XL', 'L']
}

export const STANDARD_TOKEN_IDS: SizeTokenId[] = ['XL', 'L']

export const GAUGE_DEFAULT_TOKEN: Record<GaugeDisplayStyle, SizeTokenId> = {
  arc: 'XL',
  numeric: 'L',
}
