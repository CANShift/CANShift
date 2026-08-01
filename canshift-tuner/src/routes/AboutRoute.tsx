import type { CSSProperties, ReactNode } from 'react'
import { SCREEN_PROFILES } from '@tmbk/canshift-core'
import { useDeviceStore } from '../stores/device.store'
import { useConnectionStore } from '../stores/connection.store'
import { BrandLockup } from '../components/brand/BrandLockup'
import { HeapStatsPanel } from '../components/about/HeapStatsPanel'
import { MONO_FONT } from '../lib/typography'

const REPO_URL = 'https://github.com/tburkhalterr/CANShift'
const DOCS_URL = 'https://docs.canshift.tmbk.ch'
const ISSUES_URL = 'https://github.com/tburkhalterr/CANShift/issues'

const AboutRoute = () => {
  const tunerVersion = typeof __TUNER_VERSION__ !== 'undefined' ? __TUNER_VERSION__ : 'unknown'
  const firmwareVersion = useDeviceStore((s) => s.firmwareVersion)
  const connected = useDeviceStore((s) => s.connected)
  const simulationMode = useDeviceStore((s) => s.simulationMode)
  const portPath = useDeviceStore((s) => s.portPath)
  const status = useConnectionStore((s) => s.status)
  const heapStats = useDeviceStore((s) => s.heapStats)

  const linkLabel = simulationMode
    ? 'Simulation'
    : connected
      ? `USB · ${portPath ?? 'unknown port'}`
      : '—'
  const panels = SCREEN_PROFILES.map((p) => p.name).join(' · ')

  return (
    <div style={containerStyle}>
      <div style={mainColumnStyle}>
        <BrandLockup height={72} withBaseline />

        <div style={tableStyle}>
          <FactRow label="Tuner" value={`${tunerVersion} — web`} />
          <FactRow label="Firmware on device" value={firmwareVersion ?? '—'} />
          <FactRow label="Status" value={prettyStatus(status, simulationMode)} />
          <FactRow label="Link" value={linkLabel} />
          <FactRow label="Supported panels" value={panels} />
          <FactRow label="Licence" value="MIT · github.com/tburkhalterr/CANShift" last />
        </div>

        <div style={{ display: 'flex', gap: 12 }}>
          <LinkButton href={DOCS_URL} label="DOCUMENTATION" />
          <LinkButton href={REPO_URL} label="GITHUB" />
          <LinkButton href={ISSUES_URL} label="REPORT A BUG" />
        </div>
      </div>

      <aside style={sidePanelStyle}>
        <div style={sideHeaderStyle}>DEVICE HEAP — LIVE</div>
        <div style={{ padding: '16px 20px' }}>
          <HeapStatsPanel history={heapStats} />
        </div>
      </aside>
    </div>
  )
}

interface FactRowProps {
  label: string
  value: ReactNode
  last?: boolean
}

const FactRow = ({ label, value, last = false }: FactRowProps) => (
  <div style={factRowStyle(last)}>
    <span style={{ color: 'hsl(var(--brand-neutral-600))' }}>{label}</span>
    <span style={{ fontFamily: MONO_FONT, fontSize: 13 }}>{value}</span>
  </div>
)

interface LinkButtonProps {
  href: string
  label: string
}

const LinkButton = ({ href, label }: LinkButtonProps) => (
  <a
    href={href}
    target="_blank"
    rel="noreferrer"
    className="shell-link-button"
    style={linkButtonStyle}
  >
    {label}
  </a>
)

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
  minHeight: 0,
  overflow: 'hidden',
}

const mainColumnStyle: CSSProperties = {
  flex: 1,
  minWidth: 0,
  padding: 44,
  display: 'flex',
  flexDirection: 'column',
  gap: 28,
  overflowY: 'auto',
  color: 'hsl(var(--brand-text))',
}

const tableStyle: CSSProperties = {
  maxWidth: 620,
  borderTop: '2px solid var(--brand-divider)',
}

const factRowStyle = (last: boolean): CSSProperties => ({
  display: 'flex',
  justifyContent: 'space-between',
  gap: 16,
  padding: '13px 0',
  borderBottom: last ? 'none' : '1px solid hsl(var(--brand-neutral-300))',
  fontSize: 14,
})

const linkButtonStyle: CSSProperties = {
  padding: '12px 22px',
  border: '1px solid hsl(var(--brand-neutral-400))',
  fontWeight: 800,
  fontSize: 12,
  letterSpacing: '0.08em',
  color: 'hsl(var(--brand-text))',
  textDecoration: 'none',
}

const sidePanelStyle: CSSProperties = {
  width: 360,
  flexShrink: 0,
  borderLeft: '2px solid var(--brand-divider)',
  background: 'hsl(var(--brand-neutral-100))',
  overflowY: 'auto',
}

const sideHeaderStyle: CSSProperties = {
  padding: '14px 20px',
  borderBottom: '2px solid var(--brand-divider)',
  fontWeight: 800,
  fontSize: 10,
  letterSpacing: '0.2em',
  color: 'hsl(var(--brand-neutral-600))',
}

export default AboutRoute
