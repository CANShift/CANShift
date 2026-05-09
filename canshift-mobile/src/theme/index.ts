// theme/index.ts — Visual design tokens, mirrors canshift-studio palette

export const Colors = {
  bg: '#0D0D0D',
  surface: '#111111',
  surfaceHigh: '#1A1A1A',
  surface2: '#1A1A1A',
  border: '#2A2A2A',
  accent: '#E03030',
  accentDim: '#1A0808',
  accentForeground: '#FFFFFF',
  primary: '#E03030',
  primaryForeground: '#FFFFFF',
  destructive: '#FF4444',
  destructiveForeground: '#FFFFFF',
  text: '#CCCCCC',
  textDim: '#888888',
  textMuted: '#555555',
  success: '#55AA55',
  successBg: '#1A3A1A',
  successBorder: '#336633',
  warning: '#FF8800',
  danger: '#FF4444',
  white: '#FFFFFF',
} as const

export const Typography = {
  // Sizes scaled for phone — slightly larger than studio's 320×240 canvas
  xs: 11,
  sm: 13,
  md: 15,
  lg: 18,
  xl: 24,
  xxl: 32,
  display: 48,
} as const

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const

export const Radius = {
  sm: 4,
  md: 8,
  lg: 12,
  full: 999,
} as const

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
