import type { CSSProperties } from 'react'
import { MONO_FONT } from '../../lib/typography'

interface AboutRowProps {
  label: string
  value: string
  mono?: boolean
}

const rowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '11px 14px',
  borderBottom: '1px solid hsl(var(--border))',
  fontSize: 13,
}

const rowLabelStyle: CSSProperties = {
  color: 'hsl(var(--text-dim))',
}

const rowValueStyle: CSSProperties = {
  color: 'hsl(var(--text))',
  fontWeight: 500,
}

const rowValueMonoStyle: CSSProperties = {
  color: 'hsl(var(--text))',
  fontWeight: 500,
  fontFamily: MONO_FONT,
  fontVariantNumeric: 'tabular-nums',
}

export const AboutRow = ({ label, value, mono }: AboutRowProps) => (
  <div style={rowStyle}>
    <span style={rowLabelStyle}>{label}</span>
    <span style={mono ? rowValueMonoStyle : rowValueStyle}>{value}</span>
  </div>
)
