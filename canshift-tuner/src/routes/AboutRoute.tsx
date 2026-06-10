import type { CSSProperties } from 'react'
import { useDeviceStore } from '../stores/device.store'
import { useConnectionStore } from '../stores/connection.store'
import { HeapStatsPanel } from '../components/about/HeapStatsPanel'

const REPO_URL = 'https://github.com/tburkhalterr/CANShift'
const DOCS_URL = 'https://github.com/tburkhalterr/CANShift/tree/main/canshift-tuner/docs'
const LICENSE_URL = 'https://github.com/tburkhalterr/CANShift/blob/main/LICENSE'

export default function AboutRoute() {
  const tunerVersion = typeof __TUNER_VERSION__ !== 'undefined' ? __TUNER_VERSION__ : 'unknown'
  const firmwareVersion = useDeviceStore((s) => s.firmwareVersion)
  const connected = useDeviceStore((s) => s.connected)
  const simulationMode = useDeviceStore((s) => s.simulationMode)
  const transport = useDeviceStore((s) => s.transport)
  const portPath = useDeviceStore((s) => s.portPath)
  const wifiHost = useDeviceStore((s) => s.wifiHost)
  const status = useConnectionStore((s) => s.status)
  const heapStats = useDeviceStore((s) => s.heapStats)

  const linkLabel = connected
    ? transport === 'wifi'
      ? `Wi-Fi · ${wifiHost ?? 'unknown host'}`
      : `USB · ${portPath ?? 'unknown port'}`
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
            Browser configurator for the CANShift dash. Hosted on Vercel, talks to
            the device over WebSerial.
          </p>
        </header>

        <Section title="Versions">
          <Row label="Tuner" value={`v${tunerVersion}`} mono />
          <Row label="Firmware" value={firmwareVersion ? `v${firmwareVersion}` : '—'} mono />
        </Section>

        <Section title="Device">
          <Row label="Status" value={prettyStatus(status, simulationMode)} />
          <Row label="Link" value={linkLabel} />
        </Section>

        <Section title="Diagnostics">
          <HeapStatsPanel history={heapStats} />
        </Section>

        <Section title="Resources">
          <LinkRow href={REPO_URL} label="GitHub repository" />
          <LinkRow href={DOCS_URL} label="Documentation" />
          <LinkRow href={LICENSE_URL} label="License" />
        </Section>
      </div>
    </div>
  )
}

const prettyStatus = (
  status: ReturnType<typeof useConnectionStore.getState>['status'],
  simulationMode: boolean,
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

interface SectionProps {
  title: string
  children: React.ReactNode
}

const Section = ({ title, children }: SectionProps) => {
  return (
    <section style={sectionStyle}>
      <div style={sectionTitleStyle}>{title}</div>
      <div style={sectionBodyStyle}>{children}</div>
    </section>
  )
}

interface RowProps {
  label: string
  value: string
  mono?: boolean
}

const Row = ({ label, value, mono }: RowProps) => {
  return (
    <div style={rowStyle}>
      <span style={rowLabelStyle}>{label}</span>
      <span style={mono ? rowValueMonoStyle : rowValueStyle}>{value}</span>
    </div>
  )
}

const Hint = ({ children }: { children: React.ReactNode }) => {
  return <div style={hintStyle}>{children}</div>
}

const LinkRow = ({ href, label }: { href: string; label: string }) => {
  return (
    <a href={href} target="_blank" rel="noreferrer" style={linkRowStyle}>
      <span>{label}</span>
      <span aria-hidden="true" style={{ color: 'hsl(var(--text-muted))' }}>
        ↗
      </span>
    </a>
  )
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
  borderRadius: 8,
  overflow: 'hidden',
}

const rowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '11px 14px',
  borderBottom: '1px solid hsl(var(--border))',
  fontSize: 13,
}

const rowLabelStyle: CSSProperties = {
  color: 'hsl(var(--text-dim))',
}

const rowValueStyle: CSSProperties = {
  color: 'hsl(var(--text))',
  fontWeight: 500,
}

const rowValueMonoStyle: CSSProperties = {
  color: 'hsl(var(--text))',
  fontWeight: 500,
  fontFamily: "'JetBrains Mono', ui-monospace, monospace",
  fontVariantNumeric: 'tabular-nums',
}

const hintStyle: CSSProperties = {
  padding: '8px 14px',
  fontSize: 11,
  color: 'hsl(var(--text-muted))',
  background: 'hsl(var(--bg-inset))',
  borderTop: '1px solid hsl(var(--border))',
}

const linkRowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '11px 14px',
  borderBottom: '1px solid hsl(var(--border))',
  fontSize: 13,
  color: 'hsl(var(--text))',
  textDecoration: 'none',
}
