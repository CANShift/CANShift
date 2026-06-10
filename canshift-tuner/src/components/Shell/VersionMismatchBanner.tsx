import type { CSSProperties } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { useDeviceStore } from '../../stores/device.store'

export const VersionMismatchBanner = () => {
  const compat = useDeviceStore((s) => s.firmwareCompat)
  const navigate = useNavigate()
  const location = useLocation()

  if (compat.kind !== 'mismatch') return null

  const alreadyOnFirmware = location.pathname === '/firmware'

  return (
    <div role="alert" style={bannerStyle}>
      <span style={titleStyle}>Firmware mismatch</span>
      <span style={messageStyle}>
        Tuner expects firmware <strong>v{String(compat.expected)}.x</strong> — device reports{' '}
        <strong>v{compat.version}</strong>. Burn is disabled until the firmware is updated to a
        matching build.
      </span>
      {!alreadyOnFirmware && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            navigate('/firmware')
          }}
        >
          Open Firmware
        </Button>
      )}
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

const messageStyle: CSSProperties = {
  flex: 1,
}
