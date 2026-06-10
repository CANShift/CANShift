import type { CSSProperties, ReactNode } from 'react'

export interface FlashSectionProps {
  step: number
  title: string
  status: 'idle' | 'active' | 'done' | 'disabled'
  children: ReactNode
}

export const FlashSection = ({ step, title, status, children }: FlashSectionProps) => (
  <section style={sectionStyle(status)}>
    <header style={headerStyle}>
      <span style={badgeStyle(status)}>{step}</span>
      <h2 style={titleStyle}>{title}</h2>
    </header>
    <div style={bodyStyle}>{children}</div>
  </section>
)

const sectionStyle = (status: FlashSectionProps['status']): CSSProperties => ({
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
  padding: 16,
  borderRadius: 8,
  border: `1px solid hsl(var(--border))`,
  background: 'hsl(var(--surface))',
  opacity: status === 'disabled' ? 0.55 : 1,
})

const headerStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
}

const badgeStyle = (status: FlashSectionProps['status']): CSSProperties => {
  const palette =
    status === 'done'
      ? { bg: 'hsl(var(--success) / 0.18)', fg: 'hsl(var(--success))' }
      : status === 'active'
        ? { bg: 'hsl(var(--primary) / 0.18)', fg: 'hsl(var(--primary))' }
        : { bg: 'hsl(var(--bg-inset))', fg: 'hsl(var(--text-muted))' }
  return {
    width: 22,
    height: 22,
    borderRadius: 999,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 11,
    fontWeight: 700,
    background: palette.bg,
    color: palette.fg,
    flexShrink: 0,
  }
}

const titleStyle: CSSProperties = {
  fontSize: 13,
  fontWeight: 600,
  color: 'hsl(var(--text))',
  letterSpacing: '0.02em',
  margin: 0,
}

const bodyStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 10,
  fontSize: 12,
  color: 'hsl(var(--text-dim))',
  lineHeight: 1.5,
}
