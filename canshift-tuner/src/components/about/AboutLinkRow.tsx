import type { CSSProperties } from 'react'

interface AboutLinkRowProps {
  href: string
  label: string
}

const linkRowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '11px 14px',
  borderBottom: '1px solid hsl(var(--border))',
  fontSize: 13,
  color: 'hsl(var(--text))',
  textDecoration: 'none',
}

export const AboutLinkRow = ({ href, label }: AboutLinkRowProps) => (
  <a href={href} target="_blank" rel="noreferrer" style={linkRowStyle}>
    <span>{label}</span>
    <span aria-hidden="true" style={{ color: 'hsl(var(--text-muted))' }}>
      ↗
    </span>
  </a>
)
