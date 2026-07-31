import type { CSSProperties, ReactNode } from 'react'

interface AboutSectionProps {
  title: string
  children: ReactNode
}

const sectionStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
}

const sectionTitleStyle: CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: '0.1em',
  textTransform: 'uppercase',
  color: 'hsl(var(--text-muted))',
  paddingLeft: 2,
}

const sectionBodyStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  background: 'hsl(var(--surface))',
  border: '1px solid hsl(var(--border))',
  overflow: 'hidden',
}

export const AboutSection = ({ title, children }: AboutSectionProps) => (
  <section style={sectionStyle}>
    <div style={sectionTitleStyle}>{title}</div>
    <div style={sectionBodyStyle}>{children}</div>
  </section>
)
