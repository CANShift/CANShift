import type { CSSProperties } from 'react'
import { useEffect, useState } from 'react'
import { Button } from '../ui/button'
import type { CanScannerStatus } from '../../hooks/useCanScanner'

export interface CanScanToolbarProps {
  status: CanScannerStatus
  canControl: boolean
  totalFrames: number
  totalRate: number
  startedAt: number | null
  error: string | null
  onStart: () => void
  onStop: () => void
  onReset: () => void
}

export const CanScanToolbar = ({
  status,
  canControl,
  totalFrames,
  totalRate,
  startedAt,
  error,
  onStart,
  onStop,
  onReset,
}: CanScanToolbarProps) => {
  const elapsedSec = useElapsedSeconds(startedAt, status === 'running')
  const running = status === 'running' || status === 'starting'

  return (
    <header style={toolbarStyle}>
      <div style={controlsStyle}>
        {running ? (
          <Button variant="destructive" size="sm" disabled={status !== 'running'} onClick={onStop}>
            Stop
          </Button>
        ) : (
          <Button size="sm" disabled={!canControl || status === 'stopping'} onClick={onStart}>
            Start
          </Button>
        )}
        <Button
          variant="outline"
          size="sm"
          disabled={status === 'running' || status === 'starting' || totalFrames === 0}
          onClick={onReset}
        >
          Reset
        </Button>
        {!canControl && <span style={hintStyle}>Connect a device to scan.</span>}
      </div>
      <div style={metricsStyle}>
        <Metric label="Frames" value={formatCount(totalFrames)} />
        <Metric label="Rate" value={`${String(Math.round(totalRate))} Hz`} />
        <Metric label="Elapsed" value={formatElapsed(elapsedSec)} />
        <Metric label="Status" value={prettyStatus(status)} />
      </div>
      {error && <div style={errorStyle}>Scan error: {error}</div>}
    </header>
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
      return 'Running'
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

const Metric = ({ label, value }: { label: string; value: string }) => {
  return (
    <div style={metricStyle}>
      <span style={metricLabelStyle}>{label}</span>
      <span style={metricValueStyle}>{value}</span>
    </div>
  )
}

const toolbarStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 16,
  padding: '12px 20px',
  borderBottom: '1px solid hsl(var(--border))',
  background: 'hsl(var(--surface))',
  flexWrap: 'wrap',
}

const controlsStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
}

const hintStyle: CSSProperties = {
  fontSize: 11,
  color: 'hsl(var(--text-muted))',
}

const metricsStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 18,
  fontVariantNumeric: 'tabular-nums',
}

const metricStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'flex-end',
}

const metricLabelStyle: CSSProperties = {
  fontSize: 10,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  color: 'hsl(var(--text-muted))',
}

const metricValueStyle: CSSProperties = {
  fontSize: 13,
  fontFamily: "'JetBrains Mono', ui-monospace, monospace",
  color: 'hsl(var(--text))',
}

const errorStyle: CSSProperties = {
  flexBasis: '100%',
  fontSize: 12,
  color: 'hsl(var(--destructive))',
}
