// sizeTokens.ts — widget size constraint system
// Binary halving of the 320×224 widget area (topBar = 16 px).
// Widths: 320 → 160 → 40 (each step halves; 80 dropped — see issue #131).
// Heights: 224 → 112 → 56 (28 dropped — see issue #134).
// SNAP_GRID = 4.
//
// Standard widgets (button / warning / gear / timer / image) are limited to
// L and XL — smaller sizes were dropped in 1.6.0 because they hurt readability
// while driving. Bar gauges keep narrow tokens (V, V-M) for vertical layouts
// and H-FULL for horizontal full-width strips.

import type { GaugeDisplayStyle } from '@tmbk/canshift-core'

export type SizeTokenId =
  | 'XXL' // 160×224 — half-width, full-height
  | 'XL' // 160×112 — half-width, half-height
  | 'L' // 160×56  — half-width, quarter-height
  | 'H-FULL' // 320×56  — full-width strip (doubled in 1.9.0 — issue #134)
  | 'V' // 40×224  — narrow, full-height (vertical bar)
  | 'V-M' // 40×112  — narrow, half-height

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
  'H-FULL': { id: 'H-FULL', label: 'H↔', description: '320×56', w: 320, h: 56 },
  V: { id: 'V', label: 'V↕', description: '40×224', w: 40, h: 224 },
  'V-M': { id: 'V-M', label: 'V-M', description: '40×112', w: 40, h: 112 },
}

export const SIZE_TOKEN_LIST: SizeToken[] = Object.values(SIZE_TOKENS)

/** Find the matching token for given w×h dimensions, or null if non-standard */
export function tokenFromDimensions(w: number, h: number): SizeTokenId | null {
  for (const token of SIZE_TOKEN_LIST) {
    if (token.w === w && token.h === h) return token.id
  }
  return null
}

/** Allowed size tokens for a gauge based on display style. */
export function gaugeTokenIds(displayStyle: GaugeDisplayStyle): SizeTokenId[] {
  if (displayStyle === 'arc') return ['XL', 'XXL']
  return ['XL', 'L']
}

/** Allowed size tokens for non-gauge widget types */
export const STANDARD_TOKEN_IDS: SizeTokenId[] = ['XL', 'L']

/** Default token when adding a new gauge by display style */
export const GAUGE_DEFAULT_TOKEN: Record<GaugeDisplayStyle, SizeTokenId> = {
  arc: 'XL',
  numeric: 'L',
}
