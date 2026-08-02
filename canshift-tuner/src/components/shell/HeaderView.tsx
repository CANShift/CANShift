import type { CSSProperties, ReactNode } from 'react'
import { AutosavePill } from './AutosavePill'
import { BrandLockup } from '../brand/BrandLockup'
import { MONO_FONT } from '../../lib/typography'

export type HeaderStatus =
  | 'connected'
  | 'connecting'
  | 'reconnecting'
  | 'disconnected'
  | 'simulation'

export interface HeaderViewProps {
  tunerVersion: string
  status: HeaderStatus
  projectName?: string | null
  lastSavedAt?: number | null
  portLabel?: string | null
  activityPulse?: boolean
  firmwareSlot?: ReactNode
  themeToggle?: ReactNode
  burnButton?: ReactNode
  onDisconnect?: () => void
}

const HEADER_HEIGHT = 56

interface StatusVisual {
  color: string
  label: string
}

const statusVisual = (status: HeaderStatus): StatusVisual => {
  switch (status) {
    case 'connected':
      return { color: 'hsl(var(--success))', label: 'CONNECTED' }
    case 'connecting':
      return { color: 'hsl(var(--brand-accent))', label: 'CONNECTING…' }
    case 'reconnecting':
      return { color: 'hsl(var(--brand-accent))', label: 'RECONNECTING…' }
    case 'simulation':
      return { color: 'hsl(var(--brand-accent))', label: 'SIMULATION' }
    case 'disconnected':
    default:
      return { color: 'hsl(var(--brand-neutral-500))', label: 'NO DEVICE' }
  }
}

export const HeaderView = ({
  tunerVersion,
  status,
  projectName = null,
  lastSavedAt = null,
  portLabel,
  activityPulse = false,
  firmwareSlot,
  themeToggle,
  burnButton,
  onDisconnect,
}: HeaderViewProps) => {
  const visual = statusVisual(status)
  return (
    <header style={headerStyle}>
      <div style={brandZoneStyle}>
        <BrandLockup height={24} />
        <span style={tunerTagStyle}>TUNER</span>
      </div>

      <div style={middleZoneStyle}>
        {projectName !== null && <span style={projectNameStyle}>{projectName}</span>}
        <AutosavePill lastSavedAt={lastSavedAt} />
        <span style={statusPillStyle(visual.color)}>
          <span
            aria-hidden="true"
            style={{
              width: 7,
              height: 7,
              background: visual.color,
              opacity: activityPulse ? 0.45 : 1,
              transition: 'opacity 80ms ease-out',
            }}
          />
          <span role="status" aria-live="polite">
            {visual.label}
          </span>
          {onDisconnect && (status === 'connected' || status === 'simulation') ? (
            <button
              type="button"
              onClick={onDisconnect}
              title="Disconnect from dash"
              aria-label="Disconnect"
              style={disconnectButtonStyle(visual.color)}
            >
              ✕
            </button>
          ) : null}
        </span>
        <span style={deviceInfoStyle}>
          {portLabel !== null && portLabel !== undefined && <span>{portLabel} · </span>}
          {firmwareSlot}
        </span>
        <span style={versionStyle}>tuner v{tunerVersion}</span>
      </div>

      <div style={actionZoneStyle}>
        {themeToggle}
        {burnButton}
      </div>
    </header>
  )
}

const headerStyle: CSSProperties = {
  height: HEADER_HEIGHT,
  flexShrink: 0,
  display: 'flex',
  alignItems: 'stretch',
  background: 'hsl(var(--brand-chrome-bg))',
  borderBottom: '2px solid var(--brand-divider)',
}

const brandZoneStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 11,
  padding: '0 20px 0 18px',
  borderRight: '2px solid var(--brand-divider)',
  color: 'hsl(var(--brand-text))',
}

const tunerTagStyle: CSSProperties = {
  fontWeight: 600,
  fontSize: 9,
  letterSpacing: '0.2em',
  color: 'hsl(var(--brand-neutral-600))',
  alignSelf: 'flex-end',
  paddingBottom: 10,
}

const middleZoneStyle: CSSProperties = {
  flex: 1,
  display: 'flex',
  alignItems: 'center',
  gap: 14,
  padding: '0 20px',
  minWidth: 0,
}

const projectNameStyle: CSSProperties = {
  fontWeight: 800,
  fontSize: 15,
  color: 'hsl(var(--brand-text))',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  minWidth: 0,
}

const statusPillStyle = (color: string): CSSProperties => ({
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '4px 10px',
  border: `1px solid ${color}`,
  fontWeight: 800,
  fontSize: 11,
  letterSpacing: '0.09em',
  color,
  whiteSpace: 'nowrap',
  flexShrink: 0,
})

const disconnectButtonStyle = (color: string): CSSProperties => ({
  background: 'transparent',
  border: 'none',
  color,
  cursor: 'pointer',
  fontSize: 10,
  lineHeight: 1,
  padding: 0,
})

const deviceInfoStyle: CSSProperties = {
  fontFamily: MONO_FONT,
  fontSize: 11,
  color: 'hsl(var(--brand-neutral-600))',
  whiteSpace: 'nowrap',
  flexShrink: 0,
}

const versionStyle: CSSProperties = {
  marginLeft: 'auto',
  fontFamily: MONO_FONT,
  fontSize: 11,
  color: 'hsl(var(--brand-neutral-600))',
  whiteSpace: 'nowrap',
  flexShrink: 0,
}

const actionZoneStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'stretch',
  borderLeft: '2px solid var(--brand-divider)',
}
