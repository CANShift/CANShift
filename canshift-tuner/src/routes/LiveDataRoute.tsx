import { useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { SourceBadge, type SignalSource } from '../components/live-data/SourceBadge'
import { RouteHeader } from '../components/shell/RouteHeader'
import { useLiveSignals } from '../hooks/useLiveSignals'
import { useSignalStore } from '../stores/signal.store'
import { useDeviceStore } from '../stores/device.store'
import { Input } from '../components/ui/input'

const AGE_TICK_MS = 500

const LiveDataRoute = () => {
  const signals = useSignalStore((s) => s.signals)
  const connected = useDeviceStore((s) => s.connected)
  const simulationMode = useDeviceStore((s) => s.simulationMode)
  const values = useLiveSignals()
  const [filter, setFilter] = useState('')
  const lastSeenRef = useRef<Record<string, number>>({})
  const prevValuesRef = useRef<Record<string, number>>({})
  const [tick, setTick] = useState(0)

  useEffect(() => {
    const id = window.setInterval(() => {
      setTick((t) => t + 1)
    }, AGE_TICK_MS)
    return () => {
      window.clearInterval(id)
    }
  }, [])

  useEffect(() => {
    const now = Date.now()
    for (const [name, value] of Object.entries(values)) {
      if (prevValuesRef.current[name] !== value) {
        lastSeenRef.current[name] = now
      }
    }
    prevValuesRef.current = values
  }, [values])

  const isLive = connected && !simulationMode
  const source: SignalSource = isLive ? 'live' : simulationMode ? 'sim' : 'none'

  const filteredSignals = useMemo(() => {
    const q = filter.trim().toLowerCase()
    if (!q) return signals
    return signals.filter(
      (s) => s.name.toLowerCase().includes(q) || s.unit.toLowerCase().includes(q)
    )
  }, [signals, filter])

  void tick

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
        title="Live Data"
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
              className="h-9 w-[220px] text-xs"
            />
            <button
              type="button"
              onClick={handleExport}
              disabled={signals.length === 0}
              style={exportButtonStyle(signals.length === 0)}
            >
              Export CSV
            </button>
          </>
        }
      />

      <div style={tableWrapStyle}>
        {filteredSignals.length === 0 ? (
          <div style={emptyStyle}>
            {signals.length === 0
              ? 'No signals configured. Pick an ECU profile in the Editor to see live values here.'
              : 'No signals match the current filter.'}
          </div>
        ) : (
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>Signal</th>
                <th style={thNumStyle}>Value</th>
                <th style={thNumStyle}>Range</th>
                <th style={thStyle}>Unit</th>
                <th style={thNumStyle}>Last update</th>
              </tr>
            </thead>
            <tbody>
              {filteredSignals.map((sig) => {
                const raw = values[sig.name]
                const lastSeen = lastSeenRef.current[sig.name]
                const ageMs = lastSeen ? Date.now() - lastSeen : null
                const range = sig.max - sig.min || 1
                const pct =
                  raw !== undefined ? Math.max(0, Math.min(1, (raw - sig.min) / range)) : null
                return (
                  <tr key={sig.name} style={trStyle}>
                    <td style={tdNameStyle}>{sig.name}</td>
                    <td style={tdValueStyle}>{raw !== undefined ? raw.toFixed(1) : '—'}</td>
                    <td style={tdRangeStyle}>
                      <div style={rangeBarTrackStyle}>
                        {pct !== null && (
                          <div
                            style={{
                              ...rangeBarFillStyle,
                              width: `${String(Math.round(pct * 100))}%`,
                            }}
                          />
                        )}
                      </div>
                      <span style={rangeLabelStyle}>
                        {sig.min}–{sig.max}
                      </span>
                    </td>
                    <td style={tdUnitStyle}>{sig.unit || '—'}</td>
                    <td style={tdAgeStyle}>{formatAge(ageMs, source)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

const formatAge = (ageMs: number | null, source: SignalSource): string => {
  if (source === 'none') return '—'
  if (ageMs === null) return 'never'
  if (ageMs < 1000) return '<1s'
  if (ageMs < 60_000) return `${String(Math.round(ageMs / 1000))}s ago`
  return `${String(Math.round(ageMs / 60_000))}m ago`
}

const escapeCsv = (value: string): string => {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`
  return value
}

const containerStyle: CSSProperties = {
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  background: 'hsl(var(--bg))',
  overflow: 'hidden',
}

const exportButtonStyle = (disabled: boolean): CSSProperties => ({
  background: disabled ? 'hsl(var(--bg-inset))' : 'hsl(var(--surface))',
  color: disabled ? 'hsl(var(--text-muted))' : 'hsl(var(--text))',
  border: '1px solid hsl(var(--border))',
  padding: '8px 14px',
  fontSize: 12,
  fontWeight: 600,
  cursor: disabled ? 'not-allowed' : 'pointer',
})

const tableWrapStyle: CSSProperties = {
  flex: 1,
  overflowY: 'auto',
  padding: '0 28px 24px',
}

const emptyStyle: CSSProperties = {
  textAlign: 'center',
  fontSize: 13,
  color: 'hsl(var(--text-dim))',
  padding: '64px 24px',
}

const tableStyle: CSSProperties = {
  width: '100%',
  borderCollapse: 'separate',
  borderSpacing: 0,
  fontSize: 13,
}

const thStyle: CSSProperties = {
  textAlign: 'left',
  padding: '12px 14px 10px',
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  color: 'hsl(var(--text-muted))',
  borderBottom: '1px solid hsl(var(--border))',
  position: 'sticky',
  top: 0,
  background: 'hsl(var(--bg))',
}

const thNumStyle: CSSProperties = {
  ...thStyle,
  textAlign: 'right',
}

const trStyle: CSSProperties = {
  borderBottom: '1px solid hsl(var(--border))',
}

const tdBaseStyle: CSSProperties = {
  padding: '11px 14px',
  borderBottom: '1px solid hsl(var(--border))',
  color: 'hsl(var(--text))',
}

const tdNameStyle: CSSProperties = {
  ...tdBaseStyle,
  fontFamily: "'JetBrains Mono', ui-monospace, monospace",
  fontSize: 12,
}

const tdValueStyle: CSSProperties = {
  ...tdBaseStyle,
  textAlign: 'right',
  fontVariantNumeric: 'tabular-nums',
  fontFamily: "'JetBrains Mono', ui-monospace, monospace",
}

const tdRangeStyle: CSSProperties = {
  ...tdBaseStyle,
  textAlign: 'right',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'flex-end',
  gap: 8,
  minWidth: 180,
}

const tdUnitStyle: CSSProperties = {
  ...tdBaseStyle,
  color: 'hsl(var(--text-dim))',
}

const tdAgeStyle: CSSProperties = {
  ...tdBaseStyle,
  textAlign: 'right',
  color: 'hsl(var(--text-dim))',
  fontVariantNumeric: 'tabular-nums',
  fontFamily: "'JetBrains Mono', ui-monospace, monospace",
  fontSize: 12,
}

const rangeBarTrackStyle: CSSProperties = {
  flex: 1,
  height: 6,
  background: 'hsl(var(--bg-inset))',
  overflow: 'hidden',
  maxWidth: 120,
}

const rangeBarFillStyle: CSSProperties = {
  height: '100%',
  background: 'hsl(var(--brand-accent))',
  transition: 'width 200ms linear',
}

const rangeLabelStyle: CSSProperties = {
  fontSize: 11,
  color: 'hsl(var(--text-muted))',
  fontVariantNumeric: 'tabular-nums',
  fontFamily: "'JetBrains Mono', ui-monospace, monospace",
  minWidth: 60,
  textAlign: 'right',
}

export default LiveDataRoute
