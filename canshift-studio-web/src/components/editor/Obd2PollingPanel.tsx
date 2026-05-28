// Obd2PollingPanel.tsx — Per-signal OBD-II polling editor (issue #841).
//
// Background — CANShift signals come from two places:
//   * Passive broadcast: the ECU sends a CAN frame on its own and the
//     firmware decodes it (MaxxECU and friends — `polling` field absent).
//   * Active polling: the dash must SEND a request (0x7DF, mode 01, PID)
//     and decode the response (0x7E8). OBD-II ECUs only speak this dialect.
//
// This panel lists every loaded signal and lets the user flip its input mode
// between Broadcast and OBD-II polling. When OBD-II is selected the user picks
// a PID from the J1979 Mode 01 catalog (or types a raw PID) and an interval
// (100ms..60s). Picking a catalog PID also rewrites the signal's decode
// fields (startByte/byteLength/scale/offset/unit) so a fresh user gets a
// working configuration without diving into the JSON.
//
// Edits write through `useSignalStore.setSignals` (in-memory until the user
// applies a profile or pushes to the device) — exactly the same path the
// existing inline edits use.

import { useMemo } from 'react'
import type { Obd2Mode01PidEntry, Obd2Polling, SignalDef } from '@tmbk/canshift-core'
import {
  OBD2_DEFAULT_INTERVAL_MS,
  OBD2_MAX_INTERVAL_MS,
  OBD2_MIN_INTERVAL_MS,
  OBD2_MODE01_PIDS,
  obd2PidLookup,
} from '@tmbk/canshift-core'
import { useSignalStore } from '../../stores/signal.store'

// Chrome — mirrors PropertyPanel / ThemePanel so the sidebar reads as one
// surface. Promotion to design tokens is the umbrella's S-H-5 follow-up.
const PANEL_LABEL = '#AAAAAA'
const PANEL_HINT = '#666666'
const PANEL_SECTION = '#888888'
const SECTION_DIVIDER = '#1F1F1F'
const INPUT_BG = '#111111'
const INPUT_BORDER = '#333333'
const VALUE_FG = '#CCCCCC'
const BADGE_BROADCAST_FG = '#88AACC'
const BADGE_POLLING_FG = '#FF8800'
const RAW_PID_FG = '#AA8866'

const INPUT_MODE_OPTIONS = [
  { value: 'broadcast', label: 'Broadcast (passive listen)' },
  { value: 'obd2', label: 'OBD-II polling (request/response)' },
] as const

type InputModeKey = (typeof INPUT_MODE_OPTIONS)[number]['value']

const inputStyle = {
  width: '100%',
  height: 26,
  padding: '0 6px',
  background: INPUT_BG,
  border: `1px solid ${INPUT_BORDER}`,
  borderRadius: 3,
  color: VALUE_FG,
  fontSize: 12,
  boxSizing: 'border-box' as const,
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatPid(pid: number): string {
  return `0x${pid.toString(16).toUpperCase().padStart(2, '0')}`
}

function inputModeOf(signal: SignalDef): InputModeKey {
  return signal.polling ? 'obd2' : 'broadcast'
}

/**
 * Replace the signal at `index` with `next` and persist the new array via
 * `setSignals`. Centralised so every edit path uses the same write — without
 * this helper, four call sites would each have to remember the
 * `signals.map((s, i) => i === index ? next : s)` pattern.
 */
function replaceSignal(
  signals: SignalDef[],
  setSignals: (s: SignalDef[]) => void,
  index: number,
  next: SignalDef
): void {
  const updated = signals.map((s, i) => (i === index ? next : s))
  setSignals(updated)
}

/**
 * Apply a catalog PID entry to a signal — rewrites decode fields and the
 * polling block so the result is immediately functional on a stock vehicle.
 */
function applyCatalogPid(signal: SignalDef, entry: Obd2Mode01PidEntry): SignalDef {
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

// ---------------------------------------------------------------------------
// Row — one entry per signal
// ---------------------------------------------------------------------------

interface RowProps {
  signal: SignalDef
  index: number
}

function SignalRow({ signal, index }: RowProps) {
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
    // Switching to OBD-II → seed with the RPM catalog entry by default
    // (most common signal, also the demo PID in the catalog tests).
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
    // Raw PID — keep decode fields untouched, just stamp the new PID byte.
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
    <div
      style={{
        padding: '8px 0',
        borderBottom: `1px solid ${SECTION_DIVIDER}`,
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontSize: 12, color: VALUE_FG, fontFamily: 'monospace' }}>{signal.name}</div>
        <span
          style={{
            fontSize: 9,
            color: mode === 'obd2' ? BADGE_POLLING_FG : BADGE_BROADCAST_FG,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
          }}
        >
          {mode === 'obd2' ? 'Polling' : 'Broadcast'}
        </span>
      </div>

      <label style={{ fontSize: 10, color: PANEL_HINT }}>Input mode</label>
      <select
        style={{ ...inputStyle, fontSize: 11, padding: '4px 6px' }}
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
          <label style={{ fontSize: 10, color: PANEL_HINT }}>
            PID {isRawPid && <span style={{ color: RAW_PID_FG }}>(raw)</span>}
          </label>
          <select
            style={{ ...inputStyle, fontSize: 11, padding: '4px 6px' }}
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
              <option value={polling.pid.toString(10)}>
                {formatPid(polling.pid)} — custom
              </option>
            )}
          </select>

          <label
            style={{
              fontSize: 10,
              color: PANEL_HINT,
              display: 'flex',
              justifyContent: 'space-between',
            }}
          >
            <span>Interval (ms)</span>
            <span style={{ color: VALUE_FG }}>{polling.intervalMs}</span>
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

// ---------------------------------------------------------------------------
// Panel
// ---------------------------------------------------------------------------

export default function Obd2PollingPanel() {
  const signals = useSignalStore((s) => s.signals)
  const pollingCount = useMemo(() => signals.filter((s) => s.polling).length, [signals])

  return (
    <div style={{ padding: 12, overflowY: 'auto', flex: 1 }}>
      <div
        style={{
          fontSize: 10,
          color: PANEL_LABEL,
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          marginBottom: 4,
        }}
      >
        Signal sources
      </div>
      <p style={{ fontSize: 10, color: PANEL_HINT, marginBottom: 6, lineHeight: 1.4 }}>
        OBD-II ECUs do not broadcast — the dash must send a query frame for each
        signal. Faster intervals = more CAN traffic. Stick to ≥{OBD2_MIN_INTERVAL_MS}
        ms; busy buses choke below that.
      </p>
      <div style={{ fontSize: 10, color: PANEL_SECTION, marginBottom: 4 }}>
        {signals.length} signal{signals.length === 1 ? '' : 's'} loaded ·{' '}
        <span style={{ color: BADGE_POLLING_FG }}>{pollingCount}</span> polled
      </div>

      {signals.length === 0 && (
        <p style={{ fontSize: 11, color: PANEL_HINT, marginTop: 16 }}>
          No signals loaded. Apply a profile from the toolbar first.
        </p>
      )}

      {signals.map((signal, index) => (
        <SignalRow key={signal.name} signal={signal} index={index} />
      ))}
    </div>
  )
}
