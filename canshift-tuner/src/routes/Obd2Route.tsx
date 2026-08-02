import type { CSSProperties } from 'react'
import { useMemo } from 'react'
import { OBD2_MIN_INTERVAL_MS } from '@tmbk/canshift-core'
import Obd2PollingPanel from '../components/obd2/Obd2PollingPanel'
import { DtcPanel } from '../components/obd2/DtcPanel'
import { useSignalStore } from '../stores/signal.store'
import { MONO_FONT } from '../lib/typography'

const Obd2Route = () => {
  const signals = useSignalStore((s) => s.signals)
  const pollingCount = useMemo(() => signals.filter((s) => s.polling).length, [signals])

  return (
    <div style={containerStyle}>
      <header style={toolbarStyle}>
        <span style={titleStyle}>OBD-II</span>
        <span style={summaryStyle}>
          Mode 01 request/response · {pollingCount} / {signals.length} polled · ≥
          {OBD2_MIN_INTERVAL_MS} ms
        </span>
        <button
          type="button"
          disabled
          title="Requires Mode 03 support on the device link (#1883)"
          style={readDtcsButtonStyle}
        >
          READ DTCs
        </button>
      </header>
      <div style={bodyStyle}>
        <Obd2PollingPanel />
        <DtcPanel />
      </div>
    </div>
  )
}

export default Obd2Route

const containerStyle: CSSProperties = {
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  background: 'hsl(var(--brand-chrome-bg))',
  overflow: 'hidden',
}

const toolbarStyle: CSSProperties = {
  height: 48,
  flexShrink: 0,
  display: 'flex',
  alignItems: 'center',
  gap: 14,
  padding: '0 20px',
  borderBottom: '2px solid var(--brand-divider)',
}

const titleStyle: CSSProperties = {
  fontWeight: 800,
  fontSize: 14,
  color: 'hsl(var(--brand-text))',
}

const summaryStyle: CSSProperties = {
  fontFamily: MONO_FONT,
  fontSize: 11,
  color: 'hsl(var(--brand-neutral-600))',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  minWidth: 0,
}

const readDtcsButtonStyle: CSSProperties = {
  marginLeft: 'auto',
  padding: '6px 16px',
  background: 'hsl(var(--brand-neutral-300))',
  border: 'none',
  fontWeight: 800,
  fontSize: 11,
  letterSpacing: '0.09em',
  color: 'hsl(var(--brand-neutral-500))',
  cursor: 'not-allowed',
}

const bodyStyle: CSSProperties = {
  flex: 1,
  display: 'flex',
  minHeight: 0,
}
