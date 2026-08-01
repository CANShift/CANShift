import type { CSSProperties, ReactNode } from 'react'
import { MONO_FONT } from '../../lib/typography'

interface RouteHeaderProps {
  title: string
  subtitle?: ReactNode
  action?: ReactNode
}

export const RouteHeader = ({ title, subtitle, action }: RouteHeaderProps) => (
  <header style={headerStyle}>
    <div style={titleStyle}>{title}</div>
    {subtitle != null && <div style={subtitleStyle}>{subtitle}</div>}
    {action != null && <div style={actionStyle}>{action}</div>}
  </header>
)

const headerStyle: CSSProperties = {
  height: 48,
  flexShrink: 0,
  display: 'flex',
  alignItems: 'center',
  gap: 14,
  padding: '0 20px',
  borderBottom: '2px solid var(--brand-divider)',
}

const titleStyle: CSSProperties = {
  fontWeight: 800,
  fontSize: 14,
  letterSpacing: '0.02em',
  color: 'hsl(var(--brand-text))',
  whiteSpace: 'nowrap',
}

const subtitleStyle: CSSProperties = {
  fontFamily: MONO_FONT,
  fontSize: 11,
  color: 'hsl(var(--brand-neutral-600))',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  minWidth: 0,
}

const actionStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  flexShrink: 0,
  marginLeft: 'auto',
}
