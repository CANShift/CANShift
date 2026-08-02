import type { CSSProperties, ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface TogglePillProps {
  active: boolean
  onClick: () => void
  children: ReactNode
  accentColor?: string
}

const accentPillStyle = (active: boolean, accentColor: string): CSSProperties => ({
  background: active ? 'hsl(var(--surface))' : 'transparent',
  color: active ? accentColor : 'hsl(var(--text-muted))',
  border: `1px solid ${active ? accentColor : 'hsl(var(--border))'}`,
  padding: '4px 12px',
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  cursor: 'pointer',
})

const basePillClasses = (active: boolean): string =>
  cn(
    'cursor-pointer border px-3 py-[3px] text-[11px] font-semibold uppercase tracking-[0.04em] transition-colors',
    active
      ? 'border-brand-accent bg-brand-accent/15 text-brand-accent'
      : 'border-border bg-transparent text-text-dim hover:border-brand-accent'
  )

export const TogglePill = ({ active, onClick, children, accentColor }: TogglePillProps) => (
  <button
    type="button"
    onClick={onClick}
    className={accentColor ? undefined : basePillClasses(active)}
    style={accentColor ? accentPillStyle(active, accentColor) : undefined}
  >
    {children}
  </button>
)
