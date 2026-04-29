// sizeTokens.ts — widget size constraint system
// Binary halving of the 320×224 widget area (topBar = 16 px).
// Widths: 320 → 160 → 80 → 40 (each step halves).
// Heights: 224 → 112 → 56 → 28 (each step halves).
// SNAP_GRID = 4 (GCD of 40 and 28).

import type { GaugeDisplayStyle } from '@tmbk/canshift-core'

export type SizeTokenId =
  | 'XXL' // 160×224 — half-width, full-height
  | 'XL' // 160×112 — half-width, half-height
  | 'L' // 160×56  — half-width, quarter-height
  | 'H' // 160×28  — half-width, thin strip
  | 'H-FULL' // 320×28  — full-width thin strip
  | 'M' // 80×112  — quarter-width, half-height
  | 'S' // 80×56   — quarter-width, quarter-height
  | 'XS' // 80×28   — quarter-width, thin
  | 'V' // 40×224  — narrow, full-height (vertical bar)
  | 'V-M' // 40×112  — narrow, half-height
  | 'V-S' // 40×56   — narrow, quarter-height

export interface SizeToken {
  id: SizeTokenId
  label: string
  description: string
  w: number // firmware pixels
  h: number // firmware pixels
}

export const SIZE_TOKENS: Record<SizeTokenId, SizeToken> = {
  XXL: { id: 'XXL', label: 'XXL', description: '160×224', w: 160, h: 224 },
  XL: { id: 'XL', label: 'XL', description: '160×112', w: 160, h: 112 },
  L: { id: 'L', label: 'L', description: '160×56', w: 160, h: 56 },
  H: { id: 'H', label: 'H', description: '160×28', w: 160, h: 28 },
  'H-FULL': { id: 'H-FULL', label: 'H↔', description: '320×28', w: 320, h: 28 },
  M: { id: 'M', label: 'M', description: '80×112', w: 80, h: 112 },
  S: { id: 'S', label: 'S', description: '80×56', w: 80, h: 56 },
  XS: { id: 'XS', label: 'XS', description: '80×28', w: 80, h: 28 },
  V: { id: 'V', label: 'V↕', description: '40×224', w: 40, h: 224 },
  'V-M': { id: 'V-M', label: 'V-M', description: '40×112', w: 40, h: 112 },
  'V-S': { id: 'V-S', label: 'V-S', description: '40×56', w: 40, h: 56 },
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
  if (displayStyle === 'arc') return ['XL', 'XXL']
  if (displayStyle === 'numeric') return ['XL', 'L', 'M', 'S', 'XS']
  // bar — depends on orientation
  if (barOrientation === 'horizontal') return ['H', 'H-FULL']
  return ['V-S', 'V-M', 'V']
}

/** Allowed size tokens for non-gauge widget types */
export const STANDARD_TOKEN_IDS: SizeTokenId[] = ['XL', 'L', 'M', 'S', 'XS']

/** Default token when adding a new gauge by display style */
export const GAUGE_DEFAULT_TOKEN: Record<GaugeDisplayStyle, SizeTokenId> = {
  arc: 'XL',
  bar: 'V-S',
  numeric: 'L',
}
