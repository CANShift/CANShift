import type { GaugeDisplayStyle } from '@tmbk/canshift-core'

export type SizeTokenId = 'XXL' | 'XL' | 'L' | 'H-FULL' | 'V' | 'V-M'

export interface SizeToken {
  id: SizeTokenId
  label: string
  description: string
  w: number
  h: number
}

export const SIZE_TOKENS: Record<SizeTokenId, SizeToken> = {
  XXL: { id: 'XXL', label: 'XXL', description: '160×224', w: 160, h: 224 },
  XL: { id: 'XL', label: 'XL', description: '160×112', w: 160, h: 112 },
  L: { id: 'L', label: 'L', description: '160×56', w: 160, h: 56 },
  'H-FULL': { id: 'H-FULL', label: 'H↔', description: '320×56', w: 320, h: 56 },
  V: { id: 'V', label: 'V↕', description: '40×224', w: 40, h: 224 },
  'V-M': { id: 'V-M', label: 'V-M', description: '40×112', w: 40, h: 112 },
}

export const SIZE_TOKEN_LIST: SizeToken[] = Object.values(SIZE_TOKENS)

export const tokenFromDimensions = (w: number, h: number): SizeTokenId | null =>
  SIZE_TOKEN_LIST.find((t) => t.w === w && t.h === h)?.id ?? null

export const gaugeTokenIds = (displayStyle: GaugeDisplayStyle): SizeTokenId[] =>
  displayStyle === 'arc' ? ['XL', 'XXL'] : ['XL', 'L']

export const STANDARD_TOKEN_IDS: SizeTokenId[] = ['XL', 'L']

export const GAUGE_DEFAULT_TOKEN: Record<GaugeDisplayStyle, SizeTokenId> = {
  arc: 'XL',
  numeric: 'L',
}
