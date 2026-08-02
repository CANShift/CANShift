import type { CSSProperties } from 'react'
import { useMemo } from 'react'
import type { SignalDef } from '@tmbk/canshift-core'
import { useSignalStore } from '../../stores/signal.store'
import { useDeviceStore } from '../../stores/device.store'
import { useCanScanStore } from '../../stores/can-scan/can-scan.store'
import type { CanFrameStats } from '../../stores/can-scan/accumulator'
import { useLiveSignals } from '../../hooks/useLiveSignals'
import { MONO_FONT } from '../../lib/typography'

export const parseHexFrameId = (raw: string): number => {
  const value = Number.parseInt(raw, 16)
  return Number.isNaN(value) ? -1 : value
}

export const boundFrameIds = (signals: readonly SignalDef[]): ReadonlySet<number> => {
  const ids = new Set<number>()
  for (const s of signals) {
    const id = parseHexFrameId(s.canFrameId)
    if (id >= 0) ids.add(id)
  }
  return ids
}

export const unboundFrames = (
  frames: ReadonlyMap<number, CanFrameStats>,
  signals: readonly SignalDef[]
): CanFrameStats[] => {
  const bound = boundFrameIds(signals)
  return Array.from(frames.values())
    .filter((f) => !bound.has(f.id))
    .sort((a, b) => a.id - b.id)
}

const formatFrameId = (id: number): string => `0x${id.toString(16).toUpperCase()}`

const formatPayload = (payload: readonly number[]): string =>
  payload.map((b) => b.toString(16).toUpperCase().padStart(2, '0')).join(' ')

const formatValue = (value: number | undefined): string => {
  if (value === undefined) return '- -'
  return Math.abs(value) >= 100 ? value.toFixed(0) : value.toFixed(1)
}

const SignalsPanel = () => {
  const signals = useSignalStore((s) => s.signals)
  const connected = useDeviceStore((s) => s.connected)
  const simulationMode = useDeviceStore((s) => s.simulationMode)
  const status = useCanScanStore((s) => s.status)
  const snapshot = useCanScanStore((s) => s.snapshot)
  const start = useCanScanStore((s) => s.start)
  const stop = useCanScanStore((s) => s.stop)
  const liveValues = useLiveSignals()

  const unbound = useMemo(() => unboundFrames(snapshot.frames, signals), [snapshot.frames, signals])

  const canScan = connected && !simulationMode
  const isScanning = status === 'running' || status === 'starting'

  return (
    <div style={panelStyle}>
      <div style={scanBarStyle}>
        <span style={scanDotStyle(status === 'running')} />
        <span style={scanLabelStyle}>
          {status === 'running' ? `SCAN ${String(snapshot.totalRate)} f/s` : 'SCAN OFF'}
        </span>
        <button
          type="button"
          className="editor-ghost-accent"
          disabled={!canScan}
          onClick={() => {
            void (isScanning ? stop() : start())
          }}
          style={scanButtonStyle(canScan)}
          title={canScan ? undefined : 'Connect a device to scan the bus'}
        >
          {isScanning ? 'STOP' : 'START'}
        </button>
      </div>

      <div style={listStyle}>
        <div style={sectionHeaderStyle}>BOUND — {String(signals.length)}</div>
        {signals.length === 0 && <div style={hintStyle}>No signals in the active profile.</div>}
        {signals.map((sig) => (
          <div key={sig.name} style={rowStyle}>
            <div style={rowMainStyle}>
              <span style={nameStyle}>{sig.name}</span>
              <span style={valueStyle}>
                {formatValue(liveValues[sig.name])}
                {liveValues[sig.name] !== undefined && sig.unit ? ` ${sig.unit}` : ''}
              </span>
            </div>
            <div style={rowMetaStyle}>{sig.canFrameId.toUpperCase().replace('0X', '0x')}</div>
          </div>
        ))}

        <div style={sectionHeaderStyle}>UNBOUND — {String(unbound.length)}</div>
        {unbound.length === 0 && (
          <div style={hintStyle}>
            {canScan
              ? 'Start a scan to list arriving IDs with no signal bound.'
              : simulationMode
                ? 'Simulation streams decoded signals only — connect a device to see raw IDs.'
                : 'Connect a device and start a scan to see arriving IDs.'}
          </div>
        )}
        {unbound.map((frame) => (
          <div key={frame.id} style={rowStyle}>
            <div style={rowMainStyle}>
              <span style={unboundIdStyle}>{formatFrameId(frame.id)}</span>
              <span style={rateStyle}>{String(frame.rateHz)} Hz</span>
            </div>
            <div style={rowMetaStyle}>{formatPayload(frame.lastPayload)}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default SignalsPanel

const panelStyle: CSSProperties = {
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  minHeight: 0,
}

const scanBarStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '10px 18px',
  borderBottom: '2px solid var(--brand-divider)',
}

const scanDotStyle = (running: boolean): CSSProperties => ({
  width: 7,
  height: 7,
  flexShrink: 0,
  background: running ? 'hsl(var(--brand-accent))' : 'hsl(var(--brand-neutral-400))',
})

const scanLabelStyle: CSSProperties = {
  flex: 1,
  fontFamily: MONO_FONT,
  fontSize: 10,
  letterSpacing: '0.12em',
  color: 'hsl(var(--brand-neutral-600))',
}

const scanButtonStyle = (enabled: boolean): CSSProperties => ({
  padding: '3px 10px',
  background: 'none',
  border: `1px solid ${enabled ? 'hsl(var(--brand-accent))' : 'hsl(var(--brand-neutral-300))'}`,
  fontWeight: 800,
  fontSize: 10,
  letterSpacing: '0.09em',
  color: enabled ? 'hsl(var(--brand-accent))' : 'hsl(var(--brand-neutral-400))',
  cursor: enabled ? 'pointer' : 'default',
})

const listStyle: CSSProperties = {
  flex: 1,
  overflowY: 'auto',
  minHeight: 0,
}

const sectionHeaderStyle: CSSProperties = {
  padding: '10px 18px 6px',
  fontWeight: 800,
  fontSize: 10,
  letterSpacing: '0.2em',
  color: 'hsl(var(--brand-neutral-600))',
}

const rowStyle: CSSProperties = {
  padding: '6px 18px',
  borderBottom: '1px solid hsl(var(--brand-neutral-300))',
}

const rowMainStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'baseline',
  justifyContent: 'space-between',
  gap: 10,
}

const nameStyle: CSSProperties = {
  fontSize: 12,
  color: 'hsl(var(--brand-neutral-700))',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
}

const valueStyle: CSSProperties = {
  fontFamily: MONO_FONT,
  fontSize: 12,
  color: 'hsl(var(--brand-text))',
  flexShrink: 0,
}

const unboundIdStyle: CSSProperties = {
  fontFamily: MONO_FONT,
  fontSize: 12,
  color: 'hsl(var(--brand-neutral-700))',
}

const rateStyle: CSSProperties = {
  fontFamily: MONO_FONT,
  fontSize: 11,
  color: 'hsl(var(--brand-neutral-500))',
  flexShrink: 0,
}

const rowMetaStyle: CSSProperties = {
  fontFamily: MONO_FONT,
  fontSize: 10,
  color: 'hsl(var(--brand-neutral-500))',
  marginTop: 1,
}

const hintStyle: CSSProperties = {
  padding: '4px 18px 10px',
  fontSize: 11,
  lineHeight: 1.5,
  color: 'hsl(var(--brand-neutral-500))',
}
