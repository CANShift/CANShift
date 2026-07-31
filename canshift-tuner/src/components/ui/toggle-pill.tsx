import type { CSSProperties, ReactNode } from 'react'

interface TogglePillProps {
  active: boolean
  onClick: () => void
  children: ReactNode
  accentColor?: string
}

const basePillStyle = (active: boolean): CSSProperties => ({
  background: active ? 'hsl(var(--brand-accent) / 0.15)' : 'transparent',
  color: active ? 'hsl(var(--brand-accent))' : 'hsl(var(--text-dim))',
  border: `1px solid ${active ? 'hsl(var(--brand-accent))' : 'hsl(var(--border))'}`,
  borderRadius: 999,
  padding: '3px 12px',
  fontSize: 11,
  fontFamily: 'inherit',
  fontWeight: 600,
  letterSpacing: '0.04em',
  textTransform: 'uppercase',
  cursor: 'pointer',
})

const accentPillStyle = (active: boolean, accentColor: string): CSSProperties => ({
  background: active ? 'hsl(var(--surface))' : 'transparent',
  color: active ? accentColor : 'hsl(var(--text-muted))',
  border: `1px solid ${active ? accentColor : 'hsl(var(--border))'}`,
  borderRadius: 999,
  padding: '4px 12px',
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  cursor: 'pointer',
})

export const TogglePill = ({ active, onClick, children, accentColor }: TogglePillProps) => (
  <button
    type="button"
    onClick={onClick}
    style={accentColor ? accentPillStyle(active, accentColor) : basePillStyle(active)}
  >
    {children}
  </button>
)
