import type { CSSProperties, ReactNode } from 'react'

interface RouteHeaderProps {
  title: string
  subtitle?: ReactNode
  action?: ReactNode
}

export const RouteHeader = ({ title, subtitle, action }: RouteHeaderProps) => (
  <header style={headerStyle}>
    <div style={textBlockStyle}>
      <div style={titleStyle}>{title}</div>
      {subtitle != null && <div style={subtitleStyle}>{subtitle}</div>}
    </div>
    {action != null && <div style={actionStyle}>{action}</div>}
  </header>
)

const headerStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'flex-end',
  justifyContent: 'space-between',
  gap: 16,
  padding: '20px 28px 16px',
  borderBottom: '1px solid hsl(var(--border))',
}

const textBlockStyle: CSSProperties = {
  minWidth: 0,
}

const titleStyle: CSSProperties = {
  fontSize: 20,
  fontWeight: 700,
  color: 'hsl(var(--text))',
  letterSpacing: '-0.01em',
}

const subtitleStyle: CSSProperties = {
  fontSize: 12,
  color: 'hsl(var(--text-dim))',
  marginTop: 2,
  maxWidth: 720,
}

const actionStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  flexShrink: 0,
}
