import type { CSSProperties } from 'react'
import { DeviceSection } from '../components/firmware/DeviceSection'
import { FirmwareSection } from '../components/firmware/FirmwareSection'
import { FlashActionSection } from '../components/firmware/FlashActionSection'

const FirmwareRoute = () => (
  <div style={containerStyle}>
    <header style={headerStyle}>
      <h1 style={titleStyle}>Firmware</h1>
      <p style={subtitleStyle}>
        Write a new firmware image to the dash over WebSerial. Reuses the active tuner connection so
        there is no second port selection step.
      </p>
    </header>
    <div style={bodyStyle}>
      <DeviceSection />
      <FirmwareSection />
      <FlashActionSection />
    </div>
  </div>
)

export default FirmwareRoute

const containerStyle: CSSProperties = {
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  background: 'hsl(var(--bg))',
  overflow: 'hidden',
}

const headerStyle: CSSProperties = {
  padding: '12px 20px',
  borderBottom: '1px solid hsl(var(--border))',
  background: 'hsl(var(--surface))',
}

const titleStyle: CSSProperties = {
  fontSize: 14,
  fontWeight: 600,
  color: 'hsl(var(--text))',
  letterSpacing: '0.02em',
  margin: 0,
}

const subtitleStyle: CSSProperties = {
  fontSize: 11,
  color: 'hsl(var(--text-muted))',
  marginTop: 4,
  marginBottom: 0,
}

const bodyStyle: CSSProperties = {
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  gap: 16,
  padding: 20,
  overflowY: 'auto',
}
