import type { CSSProperties, ReactNode } from 'react'
import { BrandLockup } from '../brand/BrandLockup'
import { MONO_FONT } from '../../lib/typography'

export type HeaderStatus =
  | 'connected'
  | 'connecting'
  | 'reconnecting'
  | 'disconnected'
  | 'simulation'

export interface HeaderViewProps {
  section?: string | null
  tunerVersion: string
  status: HeaderStatus
  portLabel?: string | null
  activityPulse?: boolean
  firmwareSlot?: ReactNode
  burnButton?: ReactNode
  onDisconnect?: () => void
}

const HEADER_HEIGHT = 40

interface StatusVisual {
  dot: string
  label: string
}

const statusVisual = (status: HeaderStatus): StatusVisual => {
  switch (status) {
    case 'connected':
      return { dot: 'hsl(var(--success))', label: 'Connected' }
    case 'connecting':
      return { dot: 'hsl(var(--accent))', label: 'Connecting…' }
    case 'reconnecting':
      return { dot: 'hsl(var(--accent))', label: 'Reconnecting…' }
    case 'simulation':
      return { dot: 'hsl(var(--accent))', label: 'Simulation' }
    case 'disconnected':
    default:
      return { dot: 'hsl(var(--destructive))', label: 'Disconnected' }
  }
}

export const HeaderView = ({
  section = null,
  tunerVersion,
  status,
  portLabel,
  activityPulse = false,
  firmwareSlot,
  burnButton,
  onDisconnect,
}: HeaderViewProps) => {
  const visual = statusVisual(status)
  return (
    <header
      style={{
        height: HEADER_HEIGHT,
        flexShrink: 0,
        background: 'hsl(var(--surface))',
        borderBottom: '1px solid hsl(var(--border))',
        display: 'flex',
        alignItems: 'center',
        padding: '0 14px',
        gap: 14,
      }}
    >
      <div style={brandSlotStyle}>
        <BrandLockup height={26} />
        <span style={tunerTagStyle}>TUNER</span>
        {section !== null ? <span style={sectionStyle}>› {section}</span> : null}
      </div>
      <div style={versionStyle}>v{tunerVersion}</div>

      <div style={{ flex: 1 }} />

      <div
        role="status"
        aria-live="polite"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          fontSize: 12,
          color: 'hsl(var(--text-dim))',
        }}
      >
        <span
          aria-hidden="true"
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: visual.dot,
            boxShadow: activityPulse
              ? `0 0 12px ${visual.dot}, 0 0 4px ${visual.dot}`
              : `0 0 6px ${visual.dot}`,
            transform: activityPulse ? 'scale(1.25)' : 'scale(1)',
            transition: 'box-shadow 80ms ease-out, transform 80ms ease-out',
          }}
        />
        <span style={{ color: 'hsl(var(--text))' }}>{visual.label}</span>
        {portLabel ? (
          <span style={{ fontFamily: MONO_FONT, color: 'hsl(var(--text-muted))' }}>
            {portLabel}
          </span>
        ) : null}
        {onDisconnect && (status === 'connected' || status === 'simulation') ? (
          <button
            type="button"
            onClick={onDisconnect}
            title="Disconnect from dash"
            aria-label="Disconnect"
            style={disconnectButtonStyle}
          >
            ✕
          </button>
        ) : null}
      </div>

      {firmwareSlot}
      {burnButton}
    </header>
  )
}

const disconnectButtonStyle: CSSProperties = {
  background: 'transparent',
  border: '1px solid hsl(var(--border))',
  color: 'hsl(var(--text-dim))',
  cursor: 'pointer',
  fontSize: 10,
  lineHeight: 1,
  marginLeft: 4,
  padding: '2px 6px',
}

const brandSlotStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  color: 'hsl(var(--text))',
}

const tunerTagStyle: CSSProperties = {
  fontSize: 10,
  fontWeight: 800,
  letterSpacing: '0.22em',
  color: 'hsl(var(--text-dim))',
}

const sectionStyle: CSSProperties = {
  fontSize: 13,
  fontWeight: 600,
  color: 'hsl(var(--text-dim))',
}

const versionStyle: CSSProperties = {
  fontSize: 11,
  color: 'hsl(var(--text-dim))',
  fontFamily: MONO_FONT,
  letterSpacing: '0.04em',
}
