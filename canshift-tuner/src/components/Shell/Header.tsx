// Header.tsx — Top header of the Tuner shell.
//
// Surfaces the brand, build version, live connection status (with a coloured
// dot + optional vendor/product info pulled off the SerialPort), a firmware
// version slot (placeholder until a follow-up wires the device handshake) and
// a Burn button that lights up when the editor has unsaved changes against a
// live device.

import type { CSSProperties } from 'react'
import { useConnectionStore } from '../../stores/connection.store'
import { useDeviceStore } from '../../stores/device.store'
import { useBurnDashboard } from '../../hooks/useBurnDashboard'

const HEADER_HEIGHT = 40

type Status = 'disconnected' | 'connecting' | 'connected' | 'reconnecting'

interface StatusVisual {
  dot: string
  label: string
}

function statusVisual(status: Status): StatusVisual {
  switch (status) {
    case 'connected':
      return { dot: 'hsl(var(--success))', label: 'Connected' }
    case 'connecting':
      return { dot: 'hsl(var(--accent))', label: 'Connecting…' }
    case 'reconnecting':
      return { dot: 'hsl(var(--accent))', label: 'Reconnecting…' }
    case 'disconnected':
    default:
      return { dot: 'hsl(var(--destructive))', label: 'Disconnected' }
  }
}

// Minimal structural shape of the WebSerial `SerialPort.getInfo()` return.
// Kept local so Header doesn't depend on a particular `@types/w3c-web-serial`
// pull — anything assignable to this works.
interface PortLike {
  getInfo(): { usbVendorId?: number; usbProductId?: number }
}

function readPortLabel(port: PortLike | null): string | null {
  if (!port) return null
  try {
    const info = port.getInfo()
    const vendor = info.usbVendorId
    const product = info.usbProductId
    if (vendor === undefined && product === undefined) return null
    const vendorHex = vendor !== undefined ? vendor.toString(16).padStart(4, '0') : '????'
    const productHex = product !== undefined ? product.toString(16).padStart(4, '0') : '????'
    return `${vendorHex}:${productHex}`
  } catch {
    return null
  }
}

export default function Header() {
  const status = useConnectionStore((s) => s.status)
  const port = useConnectionStore((s) => s.port)
  const simulationMode = useDeviceStore((s) => s.simulationMode)
  // Simulation has no real link, but show it in the status slot so the user
  // never wonders whether the editor they're hacking on is wired to a device
  // or just running off the demo config.
  const visual: StatusVisual = simulationMode
    ? { dot: 'hsl(var(--accent))', label: 'Simulation' }
    : statusVisual(status)
  const portLabel = !simulationMode && status === 'connected' ? readPortLabel(port) : null

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
      <div style={{ fontSize: 14, fontWeight: 700, color: 'hsl(var(--text))' }}>
        CANShift Tuner
      </div>
      <div style={versionStyle}>v{__TUNER_VERSION__}</div>

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
            boxShadow: `0 0 6px ${visual.dot}`,
          }}
        />
        <span style={{ color: 'hsl(var(--text))' }}>{visual.label}</span>
        {portLabel && (
          <span style={{ fontFamily: 'monospace', color: 'hsl(var(--text-muted))' }}>
            {portLabel}
          </span>
        )}
      </div>

      <div style={firmwareStyle} title="Firmware version (wired in a follow-up PR)">
        fw —
      </div>

      <BurnButton />
    </header>
  )
}

const versionStyle: CSSProperties = {
  fontSize: 11,
  color: 'hsl(var(--text-dim))',
  fontFamily: 'monospace',
  letterSpacing: '0.04em',
}

const firmwareStyle: CSSProperties = {
  fontSize: 11,
  color: 'hsl(var(--text-muted))',
  fontFamily: 'monospace',
  letterSpacing: '0.04em',
}

function BurnButton() {
  const { canBurn, isBurning, burn } = useBurnDashboard()
  const disabled = !canBurn
  const label = isBurning ? 'Burning…' : 'Burn'
  const title = isBurning
    ? 'Burning dashboard to the device…'
    : canBurn
      ? 'Burn dashboard to device (Cmd/Ctrl+S)'
      : 'Connect a device and edit the dashboard to enable Burn'
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => {
        void burn()
      }}
      title={title}
      style={disabled ? burnButtonStyleDisabled : burnButtonStyleEnabled}
    >
      {label}
    </button>
  )
}

const burnButtonStyleBase: CSSProperties = {
  borderRadius: 4,
  padding: '5px 14px',
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: '0.04em',
  textTransform: 'uppercase',
}

const burnButtonStyleDisabled: CSSProperties = {
  ...burnButtonStyleBase,
  background: 'hsl(var(--surface-2))',
  color: 'hsl(var(--text-dim))',
  border: '1px solid hsl(var(--border))',
  cursor: 'not-allowed',
  opacity: 0.5,
}

const burnButtonStyleEnabled: CSSProperties = {
  ...burnButtonStyleBase,
  background: 'hsl(var(--primary))',
  color: 'hsl(var(--primary-foreground))',
  border: '1px solid hsl(var(--primary))',
  cursor: 'pointer',
  boxShadow: '0 1px 4px hsl(var(--primary) / 0.3)',
}
