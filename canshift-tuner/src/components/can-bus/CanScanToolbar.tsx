import type { CSSProperties } from 'react'
import { useEffect, useState } from 'react'
import type { CanScannerStatus } from '../../hooks/useCanScanner'
import type { LearnWindow } from '../../stores/can-scan/accumulator'
import { MONO_FONT } from '../../lib/typography'
import { SortBar, type SortKey } from './SortBar'

export interface CanScanToolbarProps {
  status: CanScannerStatus
  canControl: boolean
  totalFrames: number
  totalRate: number
  startedAt: number | null
  error: string | null
  sortKey: SortKey
  learn: LearnWindow | null
  onSortChange: (key: SortKey) => void
  onStart: () => void
  onStop: () => void
  onReset: () => void
  onLearnStart: () => void
  onLearnStop: () => void
}

export const CanScanToolbar = ({
  status,
  canControl,
  totalFrames,
  totalRate,
  startedAt,
  error,
  sortKey,
  learn,
  onSortChange,
  onStart,
  onStop,
  onReset,
  onLearnStart,
  onLearnStop,
}: CanScanToolbarProps) => {
  const elapsedSec = useElapsedSeconds(startedAt, status === 'running')
  const running = status === 'running' || status === 'starting'

  return (
    <>
      <header style={toolbarStyle}>
        {running ? (
          <button
            type="button"
            className="editor-ghost-accent"
            disabled={status !== 'running'}
            onClick={onStop}
            style={stopButtonStyle(status !== 'running')}
          >
            STOP SCAN
          </button>
        ) : (
          <button
            type="button"
            className="shell-burn-button"
            disabled={!canControl || status === 'stopping'}
            onClick={onStart}
            style={startButtonStyle(!canControl || status === 'stopping')}
          >
            START SCAN
          </button>
        )}
        <button
          type="button"
          className="shell-link-button"
          disabled={running || totalFrames === 0}
          onClick={onReset}
          style={resetButtonStyle(running || totalFrames === 0)}
        >
          RESET
        </button>
        {learn?.active === true ? (
          <button
            type="button"
            className="editor-ghost-accent"
            onClick={onLearnStop}
            style={learnButtonStyle(false, true)}
            title="Stop the learn window — the CHANGES column keeps the result"
          >
            ◉ LEARNING — STOP
          </button>
        ) : (
          <button
            type="button"
            className="editor-ghost-accent"
            disabled={status !== 'running'}
            onClick={onLearnStart}
            style={learnButtonStyle(status !== 'running', false)}
            title="Start a learn window, then do the thing in the car (rev, clutch, wheel) — the table ranks the IDs that changed the most"
          >
            LEARN
          </button>
        )}
        <span style={sortLabelStyle}>SORT BY</span>
        <SortBar sortKey={sortKey} onChange={onSortChange} />
        {!canControl && <span style={hintStyle}>Connect a device to scan.</span>}
        <div style={metricsStyle}>
          <Metric label="FRAMES" value={formatCount(totalFrames)} />
          <Metric label="RATE" value={`${String(Math.round(totalRate))} Hz`} />
          <Metric label="ELAPSED" value={formatElapsed(elapsedSec)} />
          <Metric label="STATUS" value={prettyStatus(status)} accent={status === 'running'} />
        </div>
      </header>
      {error && <div style={errorStyle}>Scan error: {error}</div>}
    </>
  )
}

const useElapsedSeconds = (startedAt: number | null, running: boolean): number => {
  const [tick, setTick] = useState(0)
  useEffect(() => {
    if (!running) return
    const id = window.setInterval(() => {
      setTick((t) => t + 1)
    }, 500)
    return () => {
      window.clearInterval(id)
    }
  }, [running])
  void tick
  if (startedAt === null) return 0
  return Math.floor((performance.now() - startedAt) / 1000)
}

const prettyStatus = (status: CanScannerStatus): string => {
  switch (status) {
    case 'idle':
      return 'Idle'
    case 'starting':
      return 'Starting…'
    case 'running':
      return 'Scanning'
    case 'stopping':
      return 'Stopping…'
    case 'error':
      return 'Error'
  }
}

const formatCount = (n: number): string => {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`
  return String(n)
}

const formatElapsed = (sec: number): string => {
  if (sec < 60) return `${String(sec)}s`
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${String(m)}m ${String(s).padStart(2, '0')}s`
}

const Metric = ({
  label,
  value,
  accent = false,
}: {
  label: string
  value: string
  accent?: boolean
}) => (
  <div style={metricStyle}>
    <span style={metricLabelStyle}>{label}</span>
    <span style={metricValueStyle(accent)}>{value}</span>
  </div>
)

const toolbarStyle: CSSProperties = {
  height: 48,
  flexShrink: 0,
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  padding: '0 20px',
  borderBottom: '2px solid var(--brand-divider)',
}

const startButtonStyle = (disabled: boolean): CSSProperties => ({
  padding: '6px 18px',
  background: disabled ? 'hsl(var(--brand-neutral-300))' : 'hsl(var(--brand-accent))',
  border: 'none',
  fontWeight: 800,
  fontSize: 11,
  letterSpacing: '0.09em',
  color: disabled ? 'hsl(var(--brand-neutral-500))' : 'hsl(var(--brand-ground))',
  cursor: disabled ? 'not-allowed' : 'pointer',
})

const stopButtonStyle = (disabled: boolean): CSSProperties => ({
  padding: '6px 18px',
  background: 'none',
  border: '1px solid hsl(var(--brand-accent))',
  fontWeight: 800,
  fontSize: 11,
  letterSpacing: '0.09em',
  color: 'hsl(var(--brand-accent))',
  cursor: disabled ? 'not-allowed' : 'pointer',
  opacity: disabled ? 0.6 : 1,
})

const resetButtonStyle = (disabled: boolean): CSSProperties => ({
  padding: '6px 14px',
  background: 'none',
  border: '1px solid hsl(var(--brand-neutral-400))',
  fontWeight: 800,
  fontSize: 11,
  letterSpacing: '0.08em',
  color: disabled ? 'hsl(var(--brand-neutral-500))' : 'hsl(var(--brand-text))',
  cursor: disabled ? 'not-allowed' : 'pointer',
})

const sortLabelStyle: CSSProperties = {
  fontWeight: 800,
  fontSize: 10,
  letterSpacing: '0.18em',
  color: 'hsl(var(--brand-neutral-600))',
  marginLeft: 8,
}

const hintStyle: CSSProperties = {
  fontSize: 11,
  color: 'hsl(var(--brand-neutral-500))',
}

const metricsStyle: CSSProperties = {
  marginLeft: 'auto',
  display: 'flex',
  gap: 30,
  fontVariantNumeric: 'tabular-nums',
}

const metricStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'flex-end',
}

const metricLabelStyle: CSSProperties = {
  fontWeight: 800,
  fontSize: 9,
  letterSpacing: '0.18em',
  color: 'hsl(var(--brand-neutral-600))',
}

const metricValueStyle = (accent: boolean): CSSProperties => ({
  fontFamily: MONO_FONT,
  fontSize: 15,
  color: accent ? 'hsl(var(--brand-accent))' : 'hsl(var(--brand-text))',
})

const learnButtonStyle = (disabled: boolean, active: boolean): CSSProperties => ({
  padding: '6px 14px',
  background: active ? 'color-mix(in srgb, hsl(var(--brand-accent)) 14%, transparent)' : 'none',
  border: `1px solid ${disabled ? 'hsl(var(--brand-neutral-300))' : 'hsl(var(--brand-accent))'}`,
  fontWeight: 800,
  fontSize: 11,
  letterSpacing: '0.09em',
  color: disabled ? 'hsl(var(--brand-neutral-400))' : 'hsl(var(--brand-accent))',
  cursor: disabled ? 'default' : 'pointer',
})

const errorStyle: CSSProperties = {
  padding: '8px 20px',
  borderBottom: '1px solid hsl(var(--brand-neutral-300))',
  fontSize: 12,
  color: 'hsl(var(--brand-accent))',
}
