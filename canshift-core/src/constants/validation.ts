export const SAFE_EXPR_REGEX = /^[\w\s+\-*/%<>=!&|^().]+$/

export const MAX_EXPR_LENGTH = 128

export const DEFAULT_FRAME_TIMEOUT_MS = 2000

export const MAX_SHIFT_BITS = 63

export const isValidShiftCount = (n: number): boolean =>
  Number.isInteger(n) && n >= 0 && n <= MAX_SHIFT_BITS
