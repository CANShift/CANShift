import type { CSSProperties } from 'react'
import { Button } from '../ui/button'

export interface ThemeControlsProps {
  isDayMode: boolean | null
  disabled: boolean
  busy: boolean
  onToggle: () => void
  onSetDay: () => void
  onSetNight: () => void
}

export const ThemeControls = ({
  isDayMode,
  disabled,
  busy,
  onToggle,
  onSetDay,
  onSetNight,
}: ThemeControlsProps) => {
  return (
    <div style={controlsStyle}>
      <Button onClick={onToggle} disabled={disabled || busy}>
        Toggle day / night
      </Button>
      <div style={rowStyle}>
        <Button
          variant="outline"
          onClick={onSetDay}
          disabled={disabled || busy || isDayMode === true}
        >
          Force Day
        </Button>
        <Button
          variant="outline"
          onClick={onSetNight}
          disabled={disabled || busy || isDayMode === false}
        >
          Force Night
        </Button>
      </div>
      {busy && <div style={busyStyle}>Sending…</div>}
    </div>
  )
}

const controlsStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
}

const rowStyle: CSSProperties = {
  display: 'flex',
  gap: 8,
}

const busyStyle: CSSProperties = {
  fontSize: 11,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  color: 'hsl(var(--text-muted))',
}
