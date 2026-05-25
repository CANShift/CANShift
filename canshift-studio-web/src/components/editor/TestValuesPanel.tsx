// TestValuesPanel.tsx — Collapsible "Test mode" panel.
// When enabled, lets the user pin a value per signal. Editor previews read
// from `testMode.store` instead of the static demo percentage so thresholds,
// alerts, and edge values can be exercised offline.

import { useEffect, useMemo, useState } from 'react'
import type { SignalDef } from '@tmbk/canshift-core'
import { useSignalStore } from '../../stores/signal.store'
import { useTestModeStore } from '../../stores/testMode.store'

// Chrome shades that do not yet map to a core design token. Kept as named
// constants so the planned token promotion (audit S-H-5, umbrella #1015) only
// has to swap one place per shade. Documented in PR body as follow-up.
const HEADER_BG = '#161616' // MIRROR: between --bg (#121212) and --surface (#1F1F1F)
const HEADER_FG = '#AAAAAA' // MIRROR: between --text-dim (#BABABA) and --text-muted (#8F8F8F)
const ROW_BG = '#0F0F0F' // MIRROR: between --scrim (#000000) and --bg (#121212)
const HEADER_DIVIDER = '#222222' // MIRROR: between --bg (#121212) and --surface (#1F1F1F)
const PILL_ON_FG = '#88CC88' // MIRROR: dim variant of --success (#00CC2A)
const PILL_OFF_FG = '#555555' // MIRROR: dim variant of --text-muted (#8F8F8F)
const PILL_ON_BG = '#1A2A1A' // MIRROR: custom dim-green wash; no token match
const PILL_OFF_BG = '#1A1A1A' // MIRROR: between --bg (#121212) and --surface (#1F1F1F)
const PILL_ON_BORDER = '#336633' // MIRROR: dim variant of --success (#00CC2A)
const PILL_OFF_BORDER = '#2A2A2A' // MIRROR: between --bg and --surface
const FILTER_BG = '#0A0A0A' // MIRROR: between --scrim and --bg
const FILTER_BORDER = '#2A2A2A' // MIRROR: between --bg and --surface
const FILTER_FG = '#CCCCCC' // MIRROR: brighter than --text-dim (#BABABA), input text
const EMPTY_FG = '#444444' // MIRROR: between --bg and --text-muted, empty-state text
const NUMBER_FG = '#DDDDDD' // MIRROR: brighter than --text-dim, number-input text
const RANGE_ACCENT = '#88AACC' // MIRROR: custom cool-blue range accent; no token match
const TICK_FG = '#444444' // MIRROR: dim min/max tick labels

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
          borderTop: `1px solid ${HEADER_DIVIDER}`,
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
            color: enabled ? PILL_ON_FG : PILL_OFF_FG,
            background: enabled ? PILL_ON_BG : PILL_OFF_BG,
            border: `1px solid ${enabled ? PILL_ON_BORDER : PILL_OFF_BORDER}`,
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
              background: FILTER_BG,
              border: `1px solid ${FILTER_BORDER}`,
              borderRadius: 3,
              color: FILTER_FG,
              fontSize: 11,
              boxSizing: 'border-box',
              outline: 'none',
              marginBottom: 4,
            }}
          />
          {visible.length === 0 && (
            <div style={{ color: EMPTY_FG, fontSize: 11, padding: '6px 4px' }}>
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
                      color: HEADER_FG,
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
                      background: FILTER_BG,
                      border: `1px solid ${FILTER_BORDER}`,
                      borderRadius: 2,
                      color: NUMBER_FG,
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
                  style={{ width: '100%', accentColor: RANGE_ACCENT }}
                />
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: 8,
                    color: TICK_FG,
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
