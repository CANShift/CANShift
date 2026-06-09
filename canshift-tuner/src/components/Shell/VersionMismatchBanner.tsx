import type { CSSProperties } from 'react'
import { useDeviceStore } from '../../stores/device.store'

export function VersionMismatchBanner() {
  const compat = useDeviceStore((s) => s.firmwareCompat)
  if (compat.kind !== 'mismatch') return null
  return (
    <div role="alert" style={bannerStyle}>
      <span style={titleStyle}>Firmware mismatch</span>
      <span>
        Tuner expects firmware <strong>v{String(compat.expected)}.x</strong> — device reports{' '}
        <strong>v{compat.version}</strong>. Burn is disabled until the firmware is updated to a
        matching build.
      </span>
    </div>
  )
}

const bannerStyle: CSSProperties = {
  flexShrink: 0,
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  padding: '8px 16px',
  background: 'hsl(var(--destructive) / 0.18)',
  borderBottom: '1px solid hsl(var(--destructive))',
  color: 'hsl(var(--text))',
  fontSize: 12,
}

const titleStyle: CSSProperties = {
  fontWeight: 700,
  letterSpacing: '0.04em',
  textTransform: 'uppercase',
}
