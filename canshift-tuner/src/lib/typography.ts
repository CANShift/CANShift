import type { CSSProperties } from 'react'

export const UI_FONT = 'var(--font-ui)'

export const MONO_FONT = 'var(--font-mono)'

export const monoValueStyle: CSSProperties = {
  fontFamily: MONO_FONT,
  fontVariantNumeric: 'tabular-nums',
}

export const uiLabelStyle: CSSProperties = {
  fontFamily: UI_FONT,
  fontSize: 10,
  fontWeight: 800,
  letterSpacing: '0.18em',
  textTransform: 'uppercase',
}
