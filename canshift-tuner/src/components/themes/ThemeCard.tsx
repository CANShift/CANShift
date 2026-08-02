import type { CSSProperties } from 'react'
import type { ThemePresetEntry } from '@tmbk/canshift-core'
import { MONO_FONT } from '../../lib/typography'

export type ThemeSlotBadge = 'night' | 'day' | null

export interface ThemeCardProps {
  entry: ThemePresetEntry
  badge: ThemeSlotBadge
  targetSlot: 'night' | 'day'
  onSelect: () => void
}

export const hexLuminance = (hex: string): number => {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255
}

export const trackColorFor = (bgColor: string): string =>
  hexLuminance(bgColor) < 0.5 ? '#222222' : '#C4C4C4'

export const ThemeCard = ({ entry, badge, targetSlot, onSelect }: ThemeCardProps) => {
  const palette = entry.preset.palette
  if (!palette) return null
  const ramp = [
    entry.preset.bgColor,
    palette.surface,
    trackColorFor(entry.preset.bgColor),
    palette.textDim,
    palette.danger,
    palette.accent,
  ]

  return (
    <button
      type="button"
      onClick={onSelect}
      title={`Set as the ${targetSlot} theme of the working dashboard`}
      style={cardStyle(badge === 'night')}
    >
      <div style={headerStyle}>
        <span style={labelStyle}>{entry.label}</span>
        <span style={badge === 'night' ? activeNoteStyle : noteStyle}>
          {badge === 'night' ? 'active — night' : badge === 'day' ? 'auto at day' : entry.note}
        </span>
      </div>
      <div style={previewStyle(entry.preset.bgColor, palette.text)}>
        <span style={previewBigStyle}>5200</span>
        <span style={previewMidStyle(palette.textDim)}>195</span>
        <span style={previewDangerStyle(palette.danger)}>1.1</span>
      </div>
      <div style={rampStyle}>
        {ramp.map((color, i) => (
          <div key={i} style={{ flex: 1, background: color }} />
        ))}
      </div>
    </button>
  )
}

const cardStyle = (active: boolean): CSSProperties => ({
  display: 'flex',
  flexDirection: 'column',
  padding: 0,
  background: 'none',
  border: `2px solid ${active ? 'hsl(var(--brand-accent))' : 'var(--brand-divider)'}`,
  textAlign: 'left',
  cursor: 'pointer',
  fontFamily: 'inherit',
})

const headerStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'baseline',
  gap: 10,
  padding: '12px 14px',
  borderBottom: '2px solid var(--brand-divider)',
  width: '100%',
}

const labelStyle: CSSProperties = {
  fontWeight: 800,
  fontSize: 13,
  color: 'hsl(var(--brand-text))',
}

const noteStyle: CSSProperties = {
  marginLeft: 'auto',
  fontFamily: MONO_FONT,
  fontSize: 11,
  color: 'hsl(var(--brand-neutral-600))',
}

const activeNoteStyle: CSSProperties = {
  ...noteStyle,
  color: 'hsl(var(--brand-accent))',
}

const previewStyle = (bg: string, text: string): CSSProperties => ({
  height: 140,
  width: '100%',
  background: bg,
  display: 'flex',
  alignItems: 'flex-end',
  gap: 16,
  padding: 16,
  fontFamily: MONO_FONT,
  color: text,
})

const previewBigStyle: CSSProperties = {
  fontSize: 52,
  lineHeight: 0.9,
}

const previewMidStyle = (color: string): CSSProperties => ({
  fontSize: 30,
  lineHeight: 0.9,
  color,
})

const previewDangerStyle = (color: string): CSSProperties => ({
  marginLeft: 'auto',
  fontSize: 30,
  lineHeight: 0.9,
  color,
})

const rampStyle: CSSProperties = {
  display: 'flex',
  height: 26,
  width: '100%',
}
