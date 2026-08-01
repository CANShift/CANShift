import { useMemo, useState } from 'react'
import type { CSSProperties } from 'react'
import { SourceBadge, type SignalSource } from '../components/live-data/SourceBadge'
import { RouteHeader } from '../components/shell/RouteHeader'
import { useLiveSignals } from '../hooks/useLiveSignals'
import { useSignalStore } from '../stores/signal.store'
import { useDeviceStore } from '../stores/device.store'
import { Input } from '../components/ui/input'
import { MONO_FONT } from '../lib/typography'

const DANGER_FRACTION = 0.9

const LiveDataRoute = () => {
  const signals = useSignalStore((s) => s.signals)
  const connected = useDeviceStore((s) => s.connected)
  const simulationMode = useDeviceStore((s) => s.simulationMode)
  const values = useLiveSignals()
  const [filter, setFilter] = useState('')

  const isLive = connected && !simulationMode
  const source: SignalSource = isLive ? 'live' : simulationMode ? 'sim' : 'none'

  const filteredSignals = useMemo(() => {
    const q = filter.trim().toLowerCase()
    if (!q) return signals
    return signals.filter(
      (s) => s.name.toLowerCase().includes(q) || s.unit.toLowerCase().includes(q)
    )
  }, [signals, filter])

  const handleExport = () => {
    const rows = [
      ['name', 'value', 'unit', 'min', 'max'],
      ...signals.map((s) => {
        const v = values[s.name]
        return [s.name, v !== undefined ? String(v) : '', s.unit, String(s.min), String(s.max)]
      }),
    ]
    const csv = rows.map((r) => r.map(escapeCsv).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    const stamp = new Date().toISOString().replace(/[:.]/g, '-')
    a.href = url
    a.download = `canshift-live-${stamp}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  return (
    <div style={containerStyle}>
      <RouteHeader
        title="Live data"
        subtitle={
          <>
            {signals.length} signal{signals.length === 1 ? '' : 's'} ·{' '}
            <SourceBadge source={source} />
          </>
        }
        action={
          <>
            <Input
              type="search"
              value={filter}
              onChange={(e) => {
                setFilter(e.target.value)
              }}
              placeholder="Filter by name or unit"
              className="h-8 w-[200px] text-xs"
            />
            <button
              type="button"
              className="editor-ghost-accent"
              onClick={handleExport}
              disabled={signals.length === 0}
              style={exportButtonStyle(signals.length === 0)}
            >
              EXPORT CSV
            </button>
          </>
        }
      />

      {filteredSignals.length === 0 ? (
        <div style={emptyStyle}>
          {signals.length === 0
            ? 'No signals configured. Pick an ECU profile in the Editor to see live values here.'
            : 'No signals match the current filter.'}
        </div>
      ) : (
        <div style={gridStyle}>
          {filteredSignals.map((sig) => {
            const raw = values[sig.name]
            const range = sig.max - sig.min || 1
            const pct = raw !== undefined ? Math.max(0, Math.min(1, (raw - sig.min) / range)) : 0
            const danger = pct >= DANGER_FRACTION
            const tint = danger ? 'hsl(var(--brand-accent))' : 'hsl(var(--brand-text))'
            return (
              <div key={sig.name} style={cellStyle}>
                <span style={cellLabelStyle}>{sig.name.replace(/_/g, ' ').toUpperCase()}</span>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                  <span style={{ ...cellValueStyle, color: tint }}>
                    {raw !== undefined ? formatValue(raw) : '—'}
                  </span>
                  <span style={cellUnitStyle}>{sig.unit}</span>
                </div>
                <div style={barTrackStyle}>
                  <div
                    style={{
                      width: `${String(Math.round(pct * 100))}%`,
                      height: '100%',
                      background: tint,
                    }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

const formatValue = (value: number): string =>
  Number.isInteger(value) ? String(value) : value.toFixed(1)

const escapeCsv = (value: string): string => {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`
  return value
}

const containerStyle: CSSProperties = {
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
}

const exportButtonStyle = (disabled: boolean): CSSProperties => ({
  padding: '6px 14px',
  background: 'none',
  border: `1px solid ${disabled ? 'hsl(var(--brand-neutral-400))' : 'hsl(var(--brand-neutral-400))'}`,
  fontWeight: 800,
  fontSize: 11,
  letterSpacing: '0.08em',
  color: disabled ? 'hsl(var(--brand-neutral-500))' : 'hsl(var(--brand-text))',
  cursor: disabled ? 'not-allowed' : 'pointer',
})

const emptyStyle: CSSProperties = {
  textAlign: 'center',
  fontSize: 13,
  color: 'hsl(var(--brand-neutral-500))',
  padding: '64px 24px',
}

const gridStyle: CSSProperties = {
  flex: 1,
  overflowY: 'auto',
  display: 'grid',
  gridTemplateColumns: 'repeat(4, 1fr)',
  gridAutoRows: 'minmax(150px, 1fr)',
}

const cellStyle: CSSProperties = {
  borderRight: '1px solid hsl(var(--brand-neutral-300))',
  borderBottom: '1px solid hsl(var(--brand-neutral-300))',
  padding: '18px 20px',
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'center',
  gap: 9,
  minWidth: 0,
}

const cellLabelStyle: CSSProperties = {
  fontWeight: 800,
  fontSize: 10,
  letterSpacing: '0.18em',
  color: 'hsl(var(--brand-neutral-600))',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
}

const cellValueStyle: CSSProperties = {
  fontFamily: MONO_FONT,
  fontSize: 44,
  lineHeight: 1.1,
  fontVariantNumeric: 'tabular-nums',
}

const cellUnitStyle: CSSProperties = {
  fontFamily: MONO_FONT,
  fontSize: 13,
  color: 'hsl(var(--brand-neutral-600))',
}

const barTrackStyle: CSSProperties = {
  height: 4,
  background: 'hsl(var(--brand-neutral-300))',
}

export default LiveDataRoute
