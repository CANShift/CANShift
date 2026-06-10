import { DARK_TOKENS } from '@tmbk/canshift-core'

const MOBILE_ALIASES = {
  surfaceHigh: DARK_TOKENS.colors.surface2,
  white: DARK_TOKENS.colors.primaryForeground,
} as const

export const Colors = {
  ...DARK_TOKENS.colors,
  ...MOBILE_ALIASES,
} as const

export const Spacing = DARK_TOKENS.spacing
export const Radius = DARK_TOKENS.radii
export const Typography = DARK_TOKENS.typography

export type { DesignTokens } from '@tmbk/canshift-core'

export const HitSlop = {
  default: { top: 8, bottom: 8, left: 8, right: 8 },
  large: { top: 12, bottom: 12, left: 12, right: 12 },
} as const
