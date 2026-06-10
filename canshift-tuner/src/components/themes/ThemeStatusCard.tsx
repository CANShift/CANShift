import type { CSSProperties } from 'react'

export interface ThemeStatusCardProps {
  isDayMode: boolean | null
  connected: boolean
  simulationMode: boolean
}

export const ThemeStatusCard = ({ isDayMode, connected, simulationMode }: ThemeStatusCardProps) => {
  if (simulationMode) {
    return (
      <div style={cardStyle('night')}>
        <div style={iconStyle}>◐</div>
        <div style={detailsStyle}>
          <div style={labelStyle}>Theme</div>
          <div style={valueStyle}>Simulation</div>
          <div style={hintStyle}>Connect a real device to control its theme.</div>
        </div>
      </div>
    )
  }

  if (!connected) {
    return (
      <div style={cardStyle('night')}>
        <div style={iconStyle}>◐</div>
        <div style={detailsStyle}>
          <div style={labelStyle}>Theme</div>
          <div style={valueStyle}>Disconnected</div>
          <div style={hintStyle}>Plug the device in to read its current theme.</div>
        </div>
      </div>
    )
  }

  if (isDayMode === null) {
    return (
      <div style={cardStyle('night')}>
        <div style={iconStyle}>◐</div>
        <div style={detailsStyle}>
          <div style={labelStyle}>Theme</div>
          <div style={valueStyle}>Reading…</div>
          <div style={hintStyle}>Waiting for the firmware handshake.</div>
        </div>
      </div>
    )
  }

  return (
    <div style={cardStyle(isDayMode ? 'day' : 'night')}>
      <div style={iconStyle}>{isDayMode ? '☀' : '☾'}</div>
      <div style={detailsStyle}>
        <div style={labelStyle}>Current theme</div>
        <div style={valueStyle}>{isDayMode ? 'Day' : 'Night'}</div>
        <div style={hintStyle}>
          {isDayMode
            ? 'Bright palette: light background, dark text.'
            : 'Dark palette: black background, white text.'}
        </div>
      </div>
    </div>
  )
}

const cardStyle = (variant: 'day' | 'night'): CSSProperties => ({
  display: 'flex',
  alignItems: 'center',
  gap: 18,
  padding: '20px 22px',
  borderRadius: 10,
  background: variant === 'day' ? 'hsl(45 90% 95%)' : 'hsl(var(--bg-inset))',
  border: `1px solid ${
    variant === 'day' ? 'hsl(45 70% 70%)' : 'hsl(var(--border))'
  }`,
  color: variant === 'day' ? 'hsl(45 50% 18%)' : 'hsl(var(--text))',
  transition: 'background 200ms ease, border-color 200ms ease, color 200ms ease',
})

const iconStyle: CSSProperties = {
  fontSize: 40,
  lineHeight: 1,
}

const detailsStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
}

const labelStyle: CSSProperties = {
  fontSize: 10,
  letterSpacing: '0.1em',
  textTransform: 'uppercase',
  opacity: 0.7,
}

const valueStyle: CSSProperties = {
  fontSize: 20,
  fontWeight: 700,
  letterSpacing: '-0.01em',
}

const hintStyle: CSSProperties = {
  fontSize: 12,
  opacity: 0.75,
}
