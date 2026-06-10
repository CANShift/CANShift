import { useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { useConnectionStore } from '../../stores/connection.store'
import { useDeviceStore } from '../../stores/device.store'
import { useBurnDashboard } from '../../hooks/useBurnDashboard'
import { deviceEvents } from '../../transport'
import { FirmwareSlot } from './FirmwareSlot'

const PULSE_HOLD_MS = 220
const PULSE_THROTTLE_MS = 60

const HEADER_HEIGHT = 40

type Status = 'disconnected' | 'connecting' | 'connected' | 'reconnecting'

interface StatusVisual {
  dot: string
  label: string
}

const statusVisual = (status: Status): StatusVisual => {
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

interface PortLike {
  getInfo(): { usbVendorId?: number; usbProductId?: number }
}

const readPortLabel = (port: PortLike | null): string | null => {
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

const useSerialActivityPulse = (active: boolean): boolean => {
  const [pulsing, setPulsing] = useState(false)
  const lastTickRef = useRef(0)
  const offTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!active) {
      setPulsing(false)
      return
    }
    const unsubscribe = deviceEvents.onActivity(() => {
      const now = performance.now()
      if (now - lastTickRef.current < PULSE_THROTTLE_MS) return
      lastTickRef.current = now
      setPulsing(true)
      if (offTimerRef.current !== null) clearTimeout(offTimerRef.current)
      offTimerRef.current = setTimeout(() => {
        setPulsing(false)
        offTimerRef.current = null
      }, PULSE_HOLD_MS)
    })
    return () => {
      unsubscribe()
      if (offTimerRef.current !== null) {
        clearTimeout(offTimerRef.current)
        offTimerRef.current = null
      }
      setPulsing(false)
    }
  }, [active])

  return pulsing
}

export default function Header() {
  const status = useConnectionStore((s) => s.status)
  const port = useConnectionStore((s) => s.port)
  const simulationMode = useDeviceStore((s) => s.simulationMode)
  const firmwareVersion = useDeviceStore((s) => s.firmwareVersion)
  const firmwareCompat = useDeviceStore((s) => s.firmwareCompat)
  const pulsing = useSerialActivityPulse(status === 'connected' && !simulationMode)
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
            boxShadow: pulsing ? `0 0 12px ${visual.dot}, 0 0 4px ${visual.dot}` : `0 0 6px ${visual.dot}`,
            transform: pulsing ? 'scale(1.25)' : 'scale(1)',
            transition: 'box-shadow 80ms ease-out, transform 80ms ease-out',
          }}
        />
        <span style={{ color: 'hsl(var(--text))' }}>{visual.label}</span>
        {portLabel && (
          <span style={{ fontFamily: 'monospace', color: 'hsl(var(--text-muted))' }}>
            {portLabel}
          </span>
        )}
      </div>

      <FirmwareSlot version={firmwareVersion} compat={firmwareCompat} />

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

const BurnButton = () => {
  const { canBurn, isBurning, burn } = useBurnDashboard()
  const disabled = !canBurn
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
      {isBurning && <BurnSpinner />}
      {isBurning ? 'Burning…' : 'Burn'}
    </button>
  )
}

const BurnSpinner = () => {
  return (
    <span
      aria-hidden="true"
      style={{
        display: 'inline-block',
        width: 10,
        height: 10,
        border: '2px solid hsl(var(--primary-foreground))',
        borderTopColor: 'transparent',
        borderRadius: '50%',
        animation: 'canshift-tuner-spin 700ms linear infinite',
        marginRight: 6,
        verticalAlign: '-1px',
      }}
    />
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
