import type { CSSProperties } from 'react'
import { useEffect, useState } from 'react'
import { useDeviceStore } from '../../stores/device.store'

export function FirmwareUnresponsiveBanner() {
  const liveness = useDeviceStore((s) => s.firmwareLiveness)
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (liveness.kind !== 'unresponsive') return
    const id = window.setInterval(() => {
      setNow(Date.now())
    }, 1_000)
    return () => {
      window.clearInterval(id)
    }
  }, [liveness.kind])

  if (liveness.kind !== 'unresponsive') return null

  const elapsedSec = Math.max(0, Math.floor((now - liveness.sinceMs) / 1_000))

  return (
    <div role="alert" style={bannerStyle}>
      <span style={titleStyle}>Firmware unresponsive</span>
      <span>
        Missed {String(liveness.missedPings)} consecutive pings ({formatElapsed(elapsedSec)} ago).
        The device is connected but not replying. Try unplug / replug, or click Reboot.
      </span>
    </div>
  )
}

function formatElapsed(sec: number): string {
  if (sec < 60) return `${String(sec)} s`
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${String(m)} m ${String(s).padStart(2, '0')} s`
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
