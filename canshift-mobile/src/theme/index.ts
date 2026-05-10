// theme/index.ts — Re-exports of canshift-core design tokens (issue #526).
//
// `@tmbk/canshift-core` is the single source of truth for visual tokens
// shared between studio and mobile. This module exposes the same legacy
// named exports (`Colors`, `Spacing`, `Radius`, `Typography`) so existing
// callers keep working without touching them. Phase 3 will align variants.

import { DARK_TOKENS } from '@tmbk/canshift-core'

/**
 * Mobile-only color aliases not (yet) part of the shared SoT. They cover
 * legacy mobile screens (success surface backgrounds, dimmed accent fills,
 * a "white" alias used by switches). Keeping them here avoids a sweep of
 * component files in this PR — Phase 3 will fold them into the SoT or
 * replace them at the call sites.
 */
const LEGACY_MOBILE_COLORS = {
  surfaceHigh: DARK_TOKENS.colors.surface2,
  accentDim: '#1A0808',
  successBg: '#1A3A1A',
  successBorder: '#336633',
  white: '#FFFFFF',
} as const

export const Colors = {
  ...DARK_TOKENS.colors,
  ...LEGACY_MOBILE_COLORS,
} as const

export const Spacing = DARK_TOKENS.spacing
export const Radius = DARK_TOKENS.radii
export const Typography = DARK_TOKENS.typography

export type { DesignTokens } from '@tmbk/canshift-core'

/**
 * Minimum interactive hit target on iOS (Human Interface Guidelines).
 * Apply via `hitSlop` to any TouchableOpacity / Pressable whose visual
 * bounds are smaller than 44×44 pt. Computed per-side from the rendered
 * size, but a uniform hitSlop of 8 pads most ~28-pt icon buttons up to
 * the 44 minimum and is a safe default for small chip controls too.
 */
export const HitSlop = {
  /** Uniform 8 pt → grows ~28×28 buttons to 44×44. */
  default: { top: 8, bottom: 8, left: 8, right: 8 },
  /** Larger 12 pt for narrower icon buttons (~20×20). */
  large: { top: 12, bottom: 12, left: 12, right: 12 },
} as const
