// src/cli/theme.ts — xterm theme matching the studio's dark UI palette.

/**
 * Mirrors the colour set used by `ConsolePanel` so log streaming reads the
 * same regardless of the surface. ANSI sequences from `format.ts` map onto
 * these colours.
 */
export const CLI_THEME = {
  background: '#0A0A0A',
  foreground: '#AAAAAA',
  cursor: '#E03030',
  black: '#0A0A0A',
  red: '#CC3333',
  green: '#44CC66',
  yellow: '#CC8800',
  blue: '#5A9AC4',
  magenta: '#A060A0',
  cyan: '#4AA0A0',
  white: '#AAAAAA',
  brightBlack: '#3A3A3A',
  brightRed: '#DD4444',
  brightGreen: '#5AD877',
  brightYellow: '#DDA022',
  brightWhite: '#FFFFFF',
  selectionBackground: '#1E1E1E',
} as const

export const CLI_FONT_FAMILY = "'SF Mono', 'JetBrains Mono', Menlo, Consolas, monospace"
export const CLI_FONT_SIZE = 12
export const CLI_LINE_HEIGHT = 1.3
