import type { CSSProperties } from 'react'
import { useMemo } from 'react'
import { OBD2_MIN_INTERVAL_MS } from '@tmbk/canshift-core'
import Obd2PollingPanel from '../components/editor/Obd2PollingPanel'
import { useSignalStore } from '../stores/signal.store'

const Obd2Route = () => {
  const signals = useSignalStore((s) => s.signals)
  const pollingCount = useMemo(() => signals.filter((s) => s.polling).length, [signals])

  return (
    <div style={containerStyle}>
      <header style={headerStyle}>
        <div style={titleRowStyle}>
          <h1 style={titleStyle}>OBD-II</h1>
          <span style={badgeStyle}>
            {pollingCount} / {signals.length} polled
          </span>
        </div>
        <p style={subtitleStyle}>
          Configure which signals query the ECU via Mode 01 request/response. Stick to ≥
          {OBD2_MIN_INTERVAL_MS}
          ms intervals — busy buses choke below that.
        </p>
      </header>
      <Obd2PollingPanel />
    </div>
  )
}

export default Obd2Route

const containerStyle: CSSProperties = {
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  background: 'hsl(var(--bg))',
  overflow: 'hidden',
}

const headerStyle: CSSProperties = {
  padding: '12px 20px',
  borderBottom: '1px solid hsl(var(--border))',
  background: 'hsl(var(--surface))',
}

const titleRowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 12,
}

const titleStyle: CSSProperties = {
  fontSize: 14,
  fontWeight: 600,
  color: 'hsl(var(--text))',
  letterSpacing: '0.02em',
  margin: 0,
}

const badgeStyle: CSSProperties = {
  fontSize: 10,
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  color: 'hsl(var(--accent))',
  padding: '2px 8px',
  borderRadius: 999,
  border: '1px solid hsl(var(--border))',
  background: 'hsl(var(--bg-inset))',
}

const subtitleStyle: CSSProperties = {
  fontSize: 11,
  color: 'hsl(var(--text-muted))',
  marginTop: 4,
  marginBottom: 0,
}
