import type { CSSProperties } from 'react'
import { useMemo } from 'react'
import { OBD2_MIN_INTERVAL_MS } from '@tmbk/canshift-core'
import Obd2PollingPanel from '../components/obd2/Obd2PollingPanel'
import { RouteHeader } from '../components/shell/RouteHeader'
import { useSignalStore } from '../stores/signal.store'

const Obd2Route = () => {
  const signals = useSignalStore((s) => s.signals)
  const pollingCount = useMemo(() => signals.filter((s) => s.polling).length, [signals])

  return (
    <div style={containerStyle}>
      <RouteHeader
        title="OBD-II"
        subtitle={
          <>
            Configure which signals query the ECU via Mode 01 request/response. Stick to ≥
            {OBD2_MIN_INTERVAL_MS} ms intervals — busy buses choke below that.
          </>
        }
        action={
          <span style={badgeStyle}>
            {pollingCount} / {signals.length} polled
          </span>
        }
      />
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
