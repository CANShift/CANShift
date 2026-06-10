interface PlaceholderRouteProps {
  label: string
  icon?: string
  subtext?: string
}

export default function PlaceholderRoute({
  label,
  icon = '✦',
  subtext = 'Available in a follow-up PR',
}: PlaceholderRouteProps) {
  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        color: 'hsl(var(--text-dim))',
        fontFamily: 'system-ui, sans-serif',
        textAlign: 'center',
        padding: 24,
      }}
    >
      <div
        aria-hidden="true"
        style={{ fontSize: 32, color: 'hsl(var(--text-muted))' }}
      >
        {icon}
      </div>
      <div style={{ fontSize: 18, fontWeight: 600, color: 'hsl(var(--text))' }}>
        {label}
      </div>
      <div style={{ fontSize: 12 }}>{subtext}</div>
    </div>
  )
}
