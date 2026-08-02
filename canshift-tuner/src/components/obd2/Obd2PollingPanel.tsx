import type { CSSProperties } from 'react'
import type { Obd2Mode01PidEntry, Obd2Polling, SignalDef } from '@tmbk/canshift-core'
import {
  OBD2_DEFAULT_INTERVAL_MS,
  OBD2_MAX_INTERVAL_MS,
  OBD2_MIN_INTERVAL_MS,
  OBD2_MODE01_PIDS,
  obd2PidLookup,
} from '@tmbk/canshift-core'
import { useLiveSignals } from '../../hooks/useLiveSignals'
import { useSignalStore } from '../../stores/signal.store'
import { MONO_FONT } from '../../lib/typography'

const INPUT_MODE_OPTIONS = [
  { value: 'broadcast', label: 'Broadcast (passive listen)' },
  { value: 'obd2', label: 'OBD-II polling (request/response)' },
] as const

type InputModeKey = (typeof INPUT_MODE_OPTIONS)[number]['value']

const formatPid = (pid: number): string => {
  return `0x${pid.toString(16).toUpperCase().padStart(2, '0')}`
}

const inputModeOf = (signal: SignalDef): InputModeKey => {
  return signal.polling ? 'obd2' : 'broadcast'
}

const replaceSignal = (
  signals: SignalDef[],
  setSignals: (s: SignalDef[]) => void,
  index: number,
  next: SignalDef
): void => {
  const updated = signals.map((s, i) => (i === index ? next : s))
  setSignals(updated)
}

const applyCatalogPid = (signal: SignalDef, entry: Obd2Mode01PidEntry): SignalDef => {
  const polling: Obd2Polling = {
    mode: 0x01,
    pid: entry.pid,
    intervalMs: signal.polling?.intervalMs ?? OBD2_DEFAULT_INTERVAL_MS,
  }
  return {
    ...signal,
    canFrameId: '0x7E8',
    startByte: entry.decode.startByte,
    byteLength: entry.decode.byteLength,
    bigEndian: true,
    signed: false,
    scale: entry.decode.scale,
    offset: entry.decode.offset,
    unit: entry.unit,
    min: entry.range.min,
    max: entry.range.max,
    polling,
  }
}

const formatValue = (value: number): string =>
  Number.isInteger(value) ? String(value) : value.toFixed(1)

interface CellProps {
  signal: SignalDef
  index: number
  liveValue: number | undefined
}

const SignalCell = ({ signal, index, liveValue }: CellProps) => {
  const signals = useSignalStore((s) => s.signals)
  const setSignals = useSignalStore((s) => s.setSignals)

  const mode = inputModeOf(signal)
  const polling = signal.polling

  const catalogEntry = polling ? obd2PidLookup(polling.pid) : undefined
  const isRawPid = mode === 'obd2' && !catalogEntry

  const onModeChange = (raw: string) => {
    const nextMode = raw as InputModeKey
    if (nextMode === mode) return
    if (nextMode === 'broadcast') {
      const { polling: _drop, ...rest } = signal
      void _drop
      replaceSignal(signals, setSignals, index, rest)
      return
    }
    const seed = OBD2_MODE01_PIDS.find((e) => e.signal === signal.name) ?? OBD2_MODE01_PIDS[0]
    if (!seed) return
    replaceSignal(signals, setSignals, index, applyCatalogPid(signal, seed))
  }

  const onPidChange = (raw: string) => {
    const pid = Number.parseInt(raw, 10)
    if (Number.isNaN(pid)) return
    const entry = obd2PidLookup(pid)
    if (entry) {
      replaceSignal(signals, setSignals, index, applyCatalogPid(signal, entry))
      return
    }
    if (!polling) return
    const nextPolling: Obd2Polling = { ...polling, pid }
    replaceSignal(signals, setSignals, index, { ...signal, polling: nextPolling })
  }

  const onIntervalChange = (raw: string) => {
    const intervalMs = Number.parseInt(raw, 10)
    if (Number.isNaN(intervalMs)) return
    if (!polling) return
    const clamped = Math.min(OBD2_MAX_INTERVAL_MS, Math.max(OBD2_MIN_INTERVAL_MS, intervalMs))
    replaceSignal(signals, setSignals, index, {
      ...signal,
      polling: { ...polling, intervalMs: clamped },
    })
  }

  return (
    <div style={cellStyle}>
      <span style={polling ? pidStyle : broadcastPidStyle}>
        {polling ? formatPid(polling.pid) : 'BROADCAST'}
        {isRawPid ? ' · RAW' : ''}
      </span>
      <span style={nameStyle}>{signal.name}</span>
      <div style={valueRowStyle}>
        <span style={valueStyle}>{liveValue !== undefined ? formatValue(liveValue) : '—'}</span>
        <span style={unitStyle}>{signal.unit}</span>
      </div>

      <label style={hintStyle}>Input mode</label>
      <select
        style={selectStyle}
        value={mode}
        onChange={(e) => {
          onModeChange(e.target.value)
        }}
      >
        {INPUT_MODE_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>

      {mode === 'obd2' && polling && (
        <>
          <label style={hintStyle}>PID</label>
          <select
            style={selectStyle}
            value={polling.pid.toString(10)}
            onChange={(e) => {
              onPidChange(e.target.value)
            }}
          >
            {OBD2_MODE01_PIDS.map((entry) => (
              <option key={entry.pid} value={entry.pid.toString(10)}>
                {formatPid(entry.pid)} — {entry.label} ({entry.unit})
              </option>
            ))}
            {isRawPid && (
              <option value={polling.pid.toString(10)}>{formatPid(polling.pid)} — custom</option>
            )}
          </select>

          <label style={intervalLabelStyle}>
            <span>Interval (ms)</span>
            <span style={intervalValueStyle}>{polling.intervalMs}</span>
          </label>
          <input
            type="range"
            min={OBD2_MIN_INTERVAL_MS}
            max={OBD2_MAX_INTERVAL_MS}
            step={50}
            value={polling.intervalMs}
            onChange={(e) => {
              onIntervalChange(e.target.value)
            }}
            style={{ width: '100%' }}
          />
        </>
      )}
    </div>
  )
}

const Obd2PollingPanel = () => {
  const signals = useSignalStore((s) => s.signals)
  const values = useLiveSignals()

  if (signals.length === 0) {
    return (
      <div style={emptyStyle}>
        No signals loaded. Apply an ECU profile first — the Mode 01 grid fills from the active
        signal map.
      </div>
    )
  }

  return (
    <div style={scrollStyle}>
      <div style={sectionTitleStyle}>MODE 01 — SIGNAL SOURCES</div>
      <p style={sectionHintStyle}>
        Mode 01 polling sends a query frame per signal (request/response); Broadcast listens
        passively to CAN traffic. Stick to ≥{OBD2_MIN_INTERVAL_MS} ms polling intervals; busy buses
        choke below that.
      </p>
      <div style={gridStyle}>
        {signals.map((signal, index) => (
          <SignalCell
            key={signal.name}
            signal={signal}
            index={index}
            liveValue={values[signal.name]}
          />
        ))}
      </div>
    </div>
  )
}

export default Obd2PollingPanel

const scrollStyle: CSSProperties = {
  flex: 1,
  minWidth: 0,
  overflowY: 'auto',
}

const sectionTitleStyle: CSSProperties = {
  padding: '16px 20px 4px',
  fontWeight: 800,
  fontSize: 10,
  letterSpacing: '0.2em',
  color: 'hsl(var(--brand-neutral-600))',
}

const sectionHintStyle: CSSProperties = {
  padding: '0 20px 10px',
  fontSize: 11,
  lineHeight: 1.4,
  color: 'hsl(var(--brand-neutral-500))',
  maxWidth: 640,
}

const gridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(4, 1fr)',
  borderTop: '2px solid var(--brand-divider)',
}

const cellStyle: CSSProperties = {
  padding: '14px 20px',
  borderRight: '1px solid hsl(var(--brand-neutral-300))',
  borderBottom: '1px solid hsl(var(--brand-neutral-300))',
  display: 'flex',
  flexDirection: 'column',
  gap: 5,
  minWidth: 0,
}

const pidStyle: CSSProperties = {
  fontFamily: MONO_FONT,
  fontSize: 11,
  color: 'hsl(var(--brand-accent))',
}

const broadcastPidStyle: CSSProperties = {
  fontFamily: MONO_FONT,
  fontSize: 11,
  color: 'hsl(var(--brand-neutral-500))',
  letterSpacing: '0.08em',
}

const nameStyle: CSSProperties = {
  fontSize: 13,
  color: 'hsl(var(--brand-text))',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
}

const valueRowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'baseline',
  gap: 5,
}

const valueStyle: CSSProperties = {
  fontFamily: MONO_FONT,
  fontSize: 20,
  color: 'hsl(var(--brand-text))',
  fontVariantNumeric: 'tabular-nums',
}

const unitStyle: CSSProperties = {
  fontFamily: MONO_FONT,
  fontSize: 11,
  color: 'hsl(var(--brand-neutral-600))',
}

const hintStyle: CSSProperties = {
  marginTop: 4,
  fontSize: 10,
  color: 'hsl(var(--brand-neutral-500))',
}

const selectStyle: CSSProperties = {
  width: '100%',
  height: 26,
  padding: '0 6px',
  background: 'hsl(var(--brand-neutral-100))',
  border: '1px solid hsl(var(--brand-neutral-300))',
  color: 'hsl(var(--brand-text))',
  fontSize: 11,
  boxSizing: 'border-box',
}

const intervalLabelStyle: CSSProperties = {
  marginTop: 4,
  fontSize: 10,
  color: 'hsl(var(--brand-neutral-500))',
  display: 'flex',
  justifyContent: 'space-between',
}

const intervalValueStyle: CSSProperties = {
  fontFamily: MONO_FONT,
  color: 'hsl(var(--brand-text))',
}

const emptyStyle: CSSProperties = {
  flex: 1,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '64px 24px',
  textAlign: 'center',
  fontSize: 13,
  color: 'hsl(var(--brand-neutral-500))',
}
