// WelcomeRoute.tsx — Connect screen + WebSerial browser-support check.
//
// Entry point when no device is paired. The connect button drives the
// connection store, which internally prompts the user via
// `navigator.serial.requestPort()` and opens the chosen port. Once the store
// reports `connected` the user is bounced to the dashboard.

import type { CSSProperties } from 'react'
import { Navigate } from 'react-router-dom'
import { useConnectionStore } from '../stores/connection.store'

const SUPPORTED_BROWSERS = ['Chrome 89+', 'Edge 89+', 'Brave', 'Opera']

function isWebSerialAvailable(): boolean {
  return typeof navigator !== 'undefined' && 'serial' in navigator
}

export default function WelcomeRoute() {
  const status = useConnectionStore((s) => s.status)
  const lastError = useConnectionStore((s) => s.lastError)
  const connect = useConnectionStore((s) => s.connect)

  if (status === 'connected') {
    return <Navigate to="/dashboard" replace />
  }

  const busy = status === 'connecting' || status === 'reconnecting'
  const supported = isWebSerialAvailable()

  return (
    <div style={containerStyle}>
      <div style={cardStyle}>
        <div style={titleStyle}>Welcome to CANShift Tuner</div>
        <div style={subtitleStyle}>
          Connect your dash via USB to start configuring. Make sure Chrome,
          Edge or Brave is running over HTTPS (or localhost in dev).
        </div>

        {!supported ? (
          <UnsupportedBrowserCard />
        ) : (
          <>
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                void connect()
              }}
              style={{
                ...connectButtonStyle,
                cursor: busy ? 'wait' : 'pointer',
                opacity: busy ? 0.7 : 1,
              }}
            >
              {busy ? (
                <>
                  <Spinner /> {status === 'reconnecting' ? 'Reconnecting…' : 'Connecting…'}
                </>
              ) : (
                'Connect device'
              )}
            </button>
            {lastError && <div style={errorPillStyle}>{lastError}</div>}
          </>
        )}
      </div>
    </div>
  )
}

function UnsupportedBrowserCard() {
  return (
    <div style={unsupportedCardStyle} role="alert">
      <div style={{ fontWeight: 600, color: 'hsl(var(--text))', marginBottom: 6 }}>
        WebSerial isn't available in this browser
      </div>
      <div style={{ fontSize: 12, marginBottom: 10 }}>
        CANShift Tuner needs the WebSerial API to talk to the dash over USB.
        Open this page in one of the supported browsers:
      </div>
      <ul style={{ listStyle: 'none', padding: 0, margin: 0, fontSize: 12 }}>
        {SUPPORTED_BROWSERS.map((b) => (
          <li key={b} style={{ padding: '2px 0' }}>
            · {b}
          </li>
        ))}
      </ul>
    </div>
  )
}

function Spinner() {
  return (
    <span
      aria-hidden="true"
      style={{
        display: 'inline-block',
        width: 12,
        height: 12,
        border: '2px solid hsl(var(--primary-foreground))',
        borderTopColor: 'transparent',
        borderRadius: '50%',
        animation: 'canshift-tuner-spin 700ms linear infinite',
        marginRight: 8,
        verticalAlign: '-2px',
      }}
    />
  )
}

const containerStyle: CSSProperties = {
  flex: 1,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'hsl(var(--bg))',
  padding: 32,
  overflowY: 'auto',
}

const cardStyle: CSSProperties = {
  width: '100%',
  maxWidth: 460,
  background: 'hsl(var(--surface))',
  border: '1px solid hsl(var(--border))',
  borderRadius: 8,
  padding: '32px 28px',
  display: 'flex',
  flexDirection: 'column',
  gap: 16,
  alignItems: 'stretch',
  textAlign: 'center',
  boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
}

const titleStyle: CSSProperties = {
  fontSize: 22,
  fontWeight: 700,
  color: 'hsl(var(--text))',
  letterSpacing: '-0.01em',
}

const subtitleStyle: CSSProperties = {
  fontSize: 13,
  color: 'hsl(var(--text-dim))',
  lineHeight: 1.55,
}

const connectButtonStyle: CSSProperties = {
  background: 'hsl(var(--primary))',
  color: 'hsl(var(--primary-foreground))',
  border: 'none',
  borderRadius: 6,
  padding: '12px 20px',
  fontSize: 13,
  fontWeight: 600,
  letterSpacing: '0.04em',
  textTransform: 'uppercase',
  marginTop: 8,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
}

const errorPillStyle: CSSProperties = {
  background: 'hsl(var(--bg-inset))',
  border: '1px solid hsl(var(--destructive))',
  color: 'hsl(var(--destructive))',
  borderRadius: 4,
  padding: '8px 12px',
  fontSize: 12,
  marginTop: 4,
  textAlign: 'left',
}

const unsupportedCardStyle: CSSProperties = {
  background: 'hsl(var(--bg-inset))',
  border: '1px solid hsl(var(--border))',
  borderRadius: 6,
  padding: '14px 16px',
  color: 'hsl(var(--text-dim))',
  textAlign: 'left',
  fontSize: 13,
}
