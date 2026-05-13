// TestValuesPanel.tsx — Collapsible "Test mode" panel.
// When enabled, lets the user pin a value per signal. Editor previews read
// from `testMode.store` instead of the static demo percentage so thresholds,
// alerts, and edge values can be exercised offline.

import { useEffect, useMemo, useState } from 'react'
import type { SignalDef } from '@tmbk/canshift-core'
import { useSignalStore } from '../../stores/signal.store'
import { useTestModeStore } from '../../stores/testMode.store'

const HEADER_BG = '#161616'
const HEADER_FG = '#AAAAAA'
const ROW_BG = '#0F0F0F'

function midpoint(s: SignalDef): number {
  return Number.isFinite(s.min) && Number.isFinite(s.max) && s.max > s.min ? (s.min + s.max) / 2 : 0
}

export default function TestValuesPanel() {
  const signals = useSignalStore((s) => s.signals)
  const enabled = useTestModeStore((s) => s.enabled)
  const values = useTestModeStore((s) => s.values)
  const setEnabled = useTestModeStore((s) => s.setEnabled)
  const setValue = useTestModeStore((s) => s.setValue)
  const syncFromSignals = useTestModeStore((s) => s.syncFromSignals)
  const pruneMissing = useTestModeStore((s) => s.pruneMissing)

  const [filter, setFilter] = useState('')

  // Keep the value map aligned with the signals list — fill in midpoints for
  // newly added signals, drop entries for ones that no longer exist.
  useEffect(() => {
    syncFromSignals(signals)
    pruneMissing(signals)
  }, [signals, syncFromSignals, pruneMissing])

  const visible = useMemo(() => {
    const q = filter.trim().toLowerCase()
    if (!q) return signals
    return signals.filter(
      (s) => s.name.toLowerCase().includes(q) || s.unit.toLowerCase().includes(q)
    )
  }, [signals, filter])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
      <button
        type="button"
        onClick={() => {
          setEnabled(!enabled)
        }}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: HEADER_BG,
          border: 'none',
          borderTop: '1px solid #222222',
          color: HEADER_FG,
          padding: '8px 12px',
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          cursor: 'pointer',
        }}
        title="Toggle the test-mode signal injector"
      >
        <span>Test mode</span>
        <span
          style={{
            fontSize: 9,
            color: enabled ? '#88CC88' : '#555555',
            background: enabled ? '#1A2A1A' : '#1A1A1A',
            border: `1px solid ${enabled ? '#336633' : '#2A2A2A'}`,
            padding: '1px 6px',
            borderRadius: 8,
          }}
        >
          {enabled ? 'ON' : 'off'}
        </span>
      </button>

      {enabled && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
            padding: '6px 8px 10px',
            overflow: 'auto',
            maxHeight: 280,
          }}
        >
          <input
            type="text"
            placeholder="filter signals…"
            value={filter}
            onChange={(e) => {
              setFilter(e.target.value)
            }}
            style={{
              width: '100%',
              padding: '4px 7px',
              background: '#0A0A0A',
              border: '1px solid #2A2A2A',
              borderRadius: 3,
              color: '#CCCCCC',
              fontSize: 11,
              boxSizing: 'border-box',
              outline: 'none',
              marginBottom: 4,
            }}
          />
          {visible.length === 0 && (
            <div style={{ color: '#444444', fontSize: 11, padding: '6px 4px' }}>
              No signals match
            </div>
          )}
          {visible.map((sig) => {
            const v = values[sig.name] ?? midpoint(sig)
            const decimals =
              Math.abs(sig.max - sig.min) <= 5 ? 2 : Math.abs(sig.max - sig.min) <= 50 ? 1 : 0
            return (
              <div
                key={sig.name}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 2,
                  background: ROW_BG,
                  padding: '4px 6px',
                  borderRadius: 3,
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  <span
                    style={{
                      color: '#AAAAAA',
                      fontSize: 10,
                      fontWeight: 600,
                      letterSpacing: '0.03em',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                    title={sig.name}
                  >
                    {sig.name}
                  </span>
                  <input
                    type="number"
                    value={Number.isFinite(v) ? v.toFixed(decimals) : ''}
                    step={Math.max(1, (sig.max - sig.min) / 100).toFixed(decimals)}
                    onChange={(e) => {
                      const next = Number(e.target.value)
                      if (Number.isFinite(next)) setValue(sig.name, next)
                    }}
                    style={{
                      width: 64,
                      padding: '1px 4px',
                      background: '#0A0A0A',
                      border: '1px solid #2A2A2A',
                      borderRadius: 2,
                      color: '#DDDDDD',
                      fontSize: 10,
                      textAlign: 'right',
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  />
                </div>
                <input
                  type="range"
                  min={sig.min}
                  max={sig.max}
                  step={Math.max(0.01, (sig.max - sig.min) / 200)}
                  value={v}
                  onChange={(e) => {
                    setValue(sig.name, Number(e.target.value))
                  }}
                  style={{ width: '100%', accentColor: '#88AACC' }}
                />
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: 8,
                    color: '#444444',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  <span>{sig.min}</span>
                  <span>
                    {sig.unit} · {sig.max}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
