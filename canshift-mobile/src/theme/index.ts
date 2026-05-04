// theme/index.ts — Visual design tokens, mirrors canshift-studio palette

export const Colors = {
  bg: '#0D0D0D',
  surface: '#111111',
  surfaceHigh: '#1A1A1A',
  border: '#2A2A2A',
  accent: '#CC3333',
  accentDim: '#1A0A0A',
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
