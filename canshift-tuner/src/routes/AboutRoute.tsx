import type { CSSProperties } from 'react'
import { useDeviceStore } from '../stores/device.store'
import { useConnectionStore } from '../stores/connection.store'
import { AboutLinkRow } from '../components/about/AboutLinkRow'
import { AboutRow } from '../components/about/AboutRow'
import { AboutSection } from '../components/about/AboutSection'
import { HeapStatsPanel } from '../components/about/HeapStatsPanel'

const REPO_URL = 'https://github.com/tburkhalterr/CANShift'
const DOCS_URL = 'https://docs.canshift.tmbk.ch'
const LICENSE_URL = 'https://github.com/tburkhalterr/CANShift/blob/main/LICENSE'

const AboutRoute = () => {
  const tunerVersion = typeof __TUNER_VERSION__ !== 'undefined' ? __TUNER_VERSION__ : 'unknown'
  const firmwareVersion = useDeviceStore((s) => s.firmwareVersion)
  const connected = useDeviceStore((s) => s.connected)
  const simulationMode = useDeviceStore((s) => s.simulationMode)
  const portPath = useDeviceStore((s) => s.portPath)
  const status = useConnectionStore((s) => s.status)
  const heapStats = useDeviceStore((s) => s.heapStats)

  const linkLabel = connected
    ? `USB · ${portPath ?? 'unknown port'}`
    : simulationMode
      ? 'Simulation'
      : 'Disconnected'

  return (
    <div style={containerStyle}>
      <div style={contentStyle}>
        <header style={headerStyle}>
          <div style={badgeStyle}>About</div>
          <h1 style={titleStyle}>CANShift Tuner</h1>
          <p style={taglineStyle}>
            Browser configurator for the CANShift dash. Hosted on Vercel, talks to the device over
            WebSerial.
          </p>
        </header>

        <AboutSection title="Versions">
          <AboutRow label="Tuner" value={`v${tunerVersion}`} mono />
          <AboutRow label="Firmware" value={firmwareVersion ? `v${firmwareVersion}` : '—'} mono />
        </AboutSection>

        <AboutSection title="Device">
          <AboutRow label="Status" value={prettyStatus(status, simulationMode)} />
          <AboutRow label="Link" value={linkLabel} />
        </AboutSection>

        <AboutSection title="Diagnostics">
          <HeapStatsPanel history={heapStats} />
        </AboutSection>

        <AboutSection title="Resources">
          <AboutLinkRow href={REPO_URL} label="GitHub repository" />
          <AboutLinkRow href={DOCS_URL} label="Documentation" />
          <AboutLinkRow href={LICENSE_URL} label="License" />
        </AboutSection>
      </div>
    </div>
  )
}

const prettyStatus = (
  status: ReturnType<typeof useConnectionStore.getState>['status'],
  simulationMode: boolean
): string => {
  if (simulationMode) return 'Simulation mode'
  switch (status) {
    case 'connected':
      return 'Connected'
    case 'connecting':
      return 'Connecting…'
    case 'reconnecting':
      return 'Reconnecting…'
    case 'disconnected':
      return 'Disconnected'
    default:
      return status
  }
}

const containerStyle: CSSProperties = {
  flex: 1,
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'center',
  background: 'hsl(var(--bg))',
  padding: '40px 32px',
  overflowY: 'auto',
}

const contentStyle: CSSProperties = {
  width: '100%',
  maxWidth: 560,
  display: 'flex',
  flexDirection: 'column',
  gap: 24,
}

const headerStyle: CSSProperties = {
  textAlign: 'center',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 10,
  marginBottom: 4,
}

const badgeStyle: CSSProperties = {
  display: 'inline-block',
  padding: '4px 10px',
  borderRadius: 999,
  background: 'hsl(var(--surface))',
  border: '1px solid hsl(var(--border))',
  color: 'hsl(var(--text-dim))',
  fontFamily: "'Orbitron', system-ui, sans-serif",
  fontSize: 11,
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
}

const titleStyle: CSSProperties = {
  fontSize: 26,
  fontWeight: 700,
  color: 'hsl(var(--text))',
  letterSpacing: '-0.02em',
  margin: 0,
}

const taglineStyle: CSSProperties = {
  fontSize: 13,
  color: 'hsl(var(--text-dim))',
  lineHeight: 1.55,
  margin: 0,
  maxWidth: 440,
}

export default AboutRoute
