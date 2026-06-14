export type SignalSource = 'live' | 'sim' | 'none'

interface SourceBadgeProps {
  source: SignalSource
}

export const SourceBadge = ({ source }: SourceBadgeProps) => {
  const label = source === 'live' ? 'Live' : source === 'sim' ? 'Simulation' : 'No data'
  const color =
    source === 'live'
      ? 'hsl(var(--success))'
      : source === 'sim'
        ? 'hsl(var(--accent))'
        : 'hsl(var(--text-muted))'
  return <span style={{ color, fontWeight: 600 }}>{label}</span>
}
