import type { CSSProperties, ReactNode } from 'react'

interface TogglePillProps {
  active: boolean
  onClick: () => void
  children: ReactNode
}

const pillStyle = (active: boolean): CSSProperties => ({
  background: active ? 'hsl(var(--primary) / 0.15)' : 'transparent',
  color: active ? 'hsl(var(--primary))' : 'hsl(var(--text-dim))',
  border: `1px solid ${active ? 'hsl(var(--primary))' : 'hsl(var(--border))'}`,
  borderRadius: 999,
  padding: '3px 12px',
  fontSize: 11,
  fontFamily: 'inherit',
  fontWeight: 600,
  letterSpacing: '0.04em',
  textTransform: 'uppercase',
  cursor: 'pointer',
})

export const TogglePill = ({ active, onClick, children }: TogglePillProps) => (
  <button type="button" onClick={onClick} style={pillStyle(active)}>
    {children}
  </button>
)
