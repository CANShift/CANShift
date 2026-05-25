// ConnectScreen.tsx — Empty-state surface for picking a dash to connect to.
//
// Visible whenever `connected !== true` and the user isn't already in
// simulation mode. Offers two paths:
//   1. Connect over WebSocket to the configured target (default
//      `canshift.local:81`, with a manual IP/host override).
//   2. Enter simulation mode — same shortcut the phase-1 spike had so the
//      editor still mounts without firmware in the loop.

import { useState, type FormEvent } from 'react'
import { useDeviceStore } from '../../stores/device.store'
import { useConnectionStore } from '../../stores/connection.store'

const DEFAULT_HOST = 'canshift.local'
const DEFAULT_PORT = 81

export default function ConnectScreen() {
  const enterSimulation = useDeviceStore((s) => s.enterSimulation)

  const storedHost = useConnectionStore((s) => s.host)
  const storedPort = useConnectionStore((s) => s.port)
  const status = useConnectionStore((s) => s.status)
  const lastError = useConnectionStore((s) => s.lastError)
  const connect = useConnectionStore((s) => s.connect)

  const [host, setHost] = useState<string>(storedHost)
  const [port, setPort] = useState<string>(String(storedPort))

  const busy = status === 'connecting' || status === 'reconnecting'

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (busy) return
    const trimmed = host.trim() || DEFAULT_HOST
    const parsedPort = Number.parseInt(port, 10)
    const safePort = Number.isFinite(parsedPort) && parsedPort > 0 ? parsedPort : DEFAULT_PORT
    void connect(trimmed, safePort).catch(() => {
      // Status/error already surface via the store subscription.
    })
  }

  const useDefault = () => {
    setHost(DEFAULT_HOST)
    setPort(String(DEFAULT_PORT))
  }

  return (
    <main
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16,
        color: 'hsl(var(--text-dim))',
      }}
    >
      <div style={{ fontSize: 14, color: 'hsl(var(--text))' }}>Connect to a dash</div>

      <form
        onSubmit={submit}
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'stretch',
          gap: 8,
          width: 320,
        }}
      >
        <label style={{ fontSize: 11, color: 'hsl(var(--text-muted))' }}>
          Host
          <input
            type="text"
            value={host}
            onChange={(e) => {
              setHost(e.target.value)
            }}
            placeholder={DEFAULT_HOST}
            disabled={busy}
            style={inputStyle}
          />
        </label>

        <label style={{ fontSize: 11, color: 'hsl(var(--text-muted))' }}>
          Port
          <input
            type="number"
            min={1}
            max={65535}
            value={port}
            onChange={(e) => {
              setPort(e.target.value)
            }}
            disabled={busy}
            style={inputStyle}
          />
        </label>

        <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
          <button type="submit" disabled={busy} style={primaryButtonStyle(busy)}>
            {busy ? statusLabel(status) : 'Connect'}
          </button>
          <button
            type="button"
            onClick={useDefault}
            disabled={busy}
            style={secondaryButtonStyle(busy)}
          >
            Use canshift.local
          </button>
        </div>
      </form>

      {lastError ? (
        <div
          role="alert"
          style={{
            fontSize: 11,
            color: 'hsl(var(--error, 0 70% 60%))',
            maxWidth: 320,
            textAlign: 'center',
          }}
        >
          {formatError(lastError)}
        </div>
      ) : null}

      <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))' }}>
        or{' '}
        <button
          type="button"
          onClick={() => {
            enterSimulation()
          }}
          style={{
            background: 'none',
            border: 'none',
            color: 'hsl(var(--primary))',
            cursor: 'pointer',
            fontSize: 11,
            padding: 0,
            textDecoration: 'underline',
          }}
        >
          enter simulation mode
        </button>
      </div>
    </main>
  )
}

function statusLabel(status: string): string {
  if (status === 'connecting') return 'Connecting…'
  if (status === 'reconnecting') return 'Reconnecting…'
  return 'Connect'
}

function formatError(raw: string): string {
  if (raw === 'single_client') return 'Another client is already connected to this dash.'
  if (raw === 'ack_timeout') return 'The dash did not acknowledge in time.'
  if (raw === 'connect_failed') return 'Could not reach the dash. Check the host and port.'
  if (raw === 'connection_closed') return 'Connection closed unexpectedly.'
  return raw
}

const inputStyle = {
  display: 'block',
  width: '100%',
  marginTop: 4,
  background: 'hsl(var(--surface))',
  border: '1px solid hsl(var(--border))',
  borderRadius: 4,
  color: 'hsl(var(--text))',
  fontSize: 12,
  padding: '6px 8px',
  boxSizing: 'border-box' as const,
}

function primaryButtonStyle(disabled: boolean) {
  return {
    flex: 1,
    background: disabled ? 'hsl(var(--surface))' : 'hsl(var(--primary))',
    color: disabled ? 'hsl(var(--text-muted))' : 'hsl(var(--primary-foreground))',
    border: 'none',
    borderRadius: 4,
    padding: '8px 16px',
    fontSize: 12,
    cursor: disabled ? 'default' : 'pointer',
  }
}

function secondaryButtonStyle(disabled: boolean) {
  return {
    flex: 1,
    background: 'transparent',
    color: disabled ? 'hsl(var(--text-muted))' : 'hsl(var(--text))',
    border: '1px solid hsl(var(--border))',
    borderRadius: 4,
    padding: '8px 16px',
    fontSize: 12,
    cursor: disabled ? 'default' : 'pointer',
  }
}
