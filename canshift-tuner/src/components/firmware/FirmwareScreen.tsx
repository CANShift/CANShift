import type { CSSProperties, ReactNode } from 'react'
import { FlashSection, type FlashSectionStatus } from './FlashSection'

export interface FirmwareScreenProps {
  deviceSection?: ReactNode
  firmwareSection?: ReactNode
  flashSection?: ReactNode
  deviceStatus?: FlashSectionStatus
  firmwareStatus?: FlashSectionStatus
  flashStatus?: FlashSectionStatus
  portPath?: string | null
  connected?: boolean
  simulationMode?: boolean
}

export const FirmwareScreen = ({
  deviceSection,
  firmwareSection,
  flashSection,
  deviceStatus,
  firmwareStatus = 'idle',
  flashStatus = 'disabled',
  portPath,
  connected = false,
  simulationMode = false,
}: FirmwareScreenProps) => {
  const resolvedDeviceStatus: FlashSectionStatus =
    deviceStatus ?? (connected && !simulationMode ? 'done' : 'active')
  return (
    <div style={containerStyle}>
      <header style={headerStyle}>
        <h1 style={titleStyle}>Firmware</h1>
        <p style={subtitleStyle}>
          Write a new firmware image to the dash over WebSerial. Reuses the active tuner connection
          so there is no second port selection step.
        </p>
      </header>
      <div style={bodyStyle}>
        {deviceSection ?? (
          <FlashSection step={1} title="Device" status={resolvedDeviceStatus}>
            {connected && !simulationMode ? (
              <p style={pStyle}>
                Tuner is talking to the dash on{' '}
                <strong style={strongStyle}>{portPath ?? 'the active port'}</strong>. The flasher
                reuses this connection — no second port selection needed.
              </p>
            ) : (
              <p style={pStyle}>
                No device connected. The flasher needs an active WebSerial link to the dash. Connect
                via the Welcome screen, then come back here.
              </p>
            )}
          </FlashSection>
        )}
        {firmwareSection ?? (
          <FlashSection step={2} title="Firmware" status={firmwareStatus}>
            <p style={pStyle}>Pick which firmware build to write to the dash.</p>
            <ul style={listStyle}>
              <li>
                <strong style={strongStyle}>Latest stable release</strong> — fetched from the GitHub
                releases feed, signed, size-checked.
              </li>
              <li>
                <strong style={strongStyle}>Pre-release / beta channel</strong> — opt-in track for
                in-flight features.
              </li>
              <li>
                <strong style={strongStyle}>Local .bin file</strong> — for developers building from
                source.
              </li>
            </ul>
          </FlashSection>
        )}
        {flashSection ?? (
          <FlashSection step={3} title="Flash" status={flashStatus}>
            <p style={pStyle}>
              Erase the flash, write the new firmware, verify the checksum, then reboot into the
              freshly written image. The dash is unreachable for ~30 seconds during the flow.
            </p>
          </FlashSection>
        )}
      </div>
    </div>
  )
}

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

const pStyle: CSSProperties = { margin: 0 }
const strongStyle: CSSProperties = { color: 'hsl(var(--text))' }
const listStyle: CSSProperties = {
  margin: 0,
  paddingLeft: 18,
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
}
