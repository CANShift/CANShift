// sizeTokens.ts — widget size constraint system
// All widget dimensions must use one of these predefined tokens.
// Base unit: 25px (firmware pixels). All token dimensions are multiples of 25.

import type { GaugeDisplayStyle } from '@tmbk/canshift-core'

export type SizeTokenId =
  | 'XL'
  | 'L'
  | 'L3'
  | 'M'
  | 'S'
  | 'XS-H'
  | 'XS-H-1/2'
  | 'XS-V'
  | 'XS-V-1/2'
  | 'V-Full'
  | 'V-Full-2'

export interface SizeToken {
  id: SizeTokenId
  label: string
  description: string
  w: number // firmware pixels
  h: number // firmware pixels
}

export const SIZE_TOKENS: Record<SizeTokenId, SizeToken> = {
  XL: { id: 'XL', label: 'XL', description: '100×100', w: 100, h: 100 },
  L: { id: 'L', label: 'L', description: '100×50', w: 100, h: 50 },
  // L3 = 3 rows of 25px — fits: XL(100) + L(50) + L3(75) = 225 (full widget area with 15px topbar)
  L3: { id: 'L3', label: 'L3', description: '100×75', w: 100, h: 75 },
  M: { id: 'M', label: 'M', description: '50×50', w: 50, h: 50 },
  S: { id: 'S', label: 'S', description: '25×25', w: 25, h: 25 },
  'XS-H': { id: 'XS-H', label: 'H', description: '100×25', w: 100, h: 25 },
  'XS-H-1/2': { id: 'XS-H-1/2', label: 'H½', description: '50×25', w: 50, h: 25 },
  'XS-V': { id: 'XS-V', label: 'V', description: '25×100', w: 25, h: 100 },
  'XS-V-1/2': { id: 'XS-V-1/2', label: 'V½', description: '25×50', w: 25, h: 50 },
  // 225 = 9×25 — fits the 228px widget area (240 − 12px topbar) leaving 3px clearance
  'V-Full': { id: 'V-Full', label: 'V↕', description: '25×225', w: 25, h: 225 },
  'V-Full-2': { id: 'V-Full-2', label: 'V↕2', description: '50×225', w: 50, h: 225 },
}

export const SIZE_TOKEN_LIST: SizeToken[] = Object.values(SIZE_TOKENS)

/** Find the matching token for given w×h dimensions, or null if non-standard */
export function tokenFromDimensions(w: number, h: number): SizeTokenId | null {
  for (const token of SIZE_TOKEN_LIST) {
    if (token.w === w && token.h === h) return token.id
  }
  return null
}

/** Allowed size tokens for a gauge based on display style and bar orientation */
export function gaugeTokenIds(
  displayStyle: GaugeDisplayStyle,
  barOrientation?: 'horizontal' | 'vertical'
): SizeTokenId[] {
  if (displayStyle === 'arc') return ['M', 'XL']
  if (displayStyle === 'numeric') return ['XL', 'L', 'L3', 'M', 'S']
  // bar — depends on orientation
  if (barOrientation === 'horizontal') return ['XS-H', 'XS-H-1/2']
  return ['XS-V-1/2', 'XS-V', 'V-Full', 'V-Full-2']
}

/** Allowed size tokens for non-gauge widget types */
export const STANDARD_TOKEN_IDS: SizeTokenId[] = ['XL', 'L', 'L3', 'M', 'S']

/** Default token when adding a new gauge by display style */
export const GAUGE_DEFAULT_TOKEN: Record<GaugeDisplayStyle, SizeTokenId> = {
  arc: 'M',
  bar: 'XS-V-1/2',
  numeric: 'L',
}
