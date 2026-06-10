import { useLiveSignals } from '../../hooks/useLiveSignals'
import { useSignalStore } from '../../stores/signal.store'
import { useDeviceStore } from '../../stores/device.store'

const PANEL_BG = '#0D0D0D'
const HEADER_BORDER = '#2A2A2A'
const ROW_BORDER = '#181818'
const LABEL_FG = '#AAAAAA'
const MUTED_FG = '#888888'
const DIM_FG = '#444444'
const UNIT_FG = '#555555'
const NO_DATA_FG = '#555555'
const BAR_TRACK = '#1E1E1E'
const VALUE_FG = '#CCCCCC'
const SIM_FG = '#FF8800'
const LIVE_FG = '#33CC55'
const DANGER_FG = '#FF4444'
const DANGER_BAR = '#FF444488'
const WARN_BAR = '#FF880088'
const OK_BAR = '#33CC5555'

interface DiagnosticsPanelProps {
  scale: number
}

export default function DiagnosticsPanel({ scale }: DiagnosticsPanelProps) {
  const signals = useSignalStore((s) => s.signals)
  const connected = useDeviceStore((s) => s.connected)
  const simulationMode = useDeviceStore((s) => s.simulationMode)
  const values = useLiveSignals()
  const isLive = connected && !simulationMode

  const fs = Math.round(scale * 5.5)
  const pad = Math.round(scale * 6)
  const rowPad = Math.round(scale * 3)
  const barW = Math.round(scale * 32)
  const barH = Math.round(scale * 4)

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        background: PANEL_BG,
        zIndex: 100,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          padding: `${String(pad)}px ${String(pad)}px ${String(Math.round(scale * 3))}px`,
          borderBottom: `1px solid ${HEADER_BORDER}`,
          flexShrink: 0,
          display: 'flex',
          alignItems: 'baseline',
          gap: Math.round(scale * 4),
        }}
      >
        <span
          style={{
            fontSize: fs + 2,
            color: 'hsl(var(--text))',
            fontWeight: 600,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
          }}
        >
          Diagnostics
        </span>
        <span
          style={{
            fontSize: fs - 1,
            color: isLive ? LIVE_FG : simulationMode ? SIM_FG : NO_DATA_FG,
            fontWeight: 600,
            letterSpacing: '0.06em',
          }}
        >
          {isLive ? 'LIVE' : simulationMode ? 'SIM' : 'NO DATA'}
        </span>
        <span style={{ fontSize: fs - 1, color: DIM_FG, marginLeft: 'auto' }}>
          swipe ↓ to close
        </span>
      </div>

      <div style={{ overflowY: 'auto', flex: 1 }}>
        {signals.length === 0 ? (
          <div
            style={{
              padding: pad,
              fontSize: fs,
              color: MUTED_FG,
              textAlign: 'center',
              paddingTop: pad * 3,
            }}
          >
            No signals configured.
          </div>
        ) : (
          signals.map((sig) => {
            const raw = values[sig.name]
            const range = sig.max - sig.min || 1
            const pct = raw !== undefined ? Math.max(0, Math.min(1, (raw - sig.min) / range)) : null
            const isDanger = pct !== null && pct >= 0.95
            const isWarn = pct !== null && !isDanger && pct >= 0.8
            const valueColor = isDanger ? DANGER_FG : isWarn ? SIM_FG : VALUE_FG
            const barColor = isDanger ? DANGER_BAR : isWarn ? WARN_BAR : OK_BAR
            const valueStr = raw !== undefined ? raw.toFixed(1) : '—'

            return (
              <div
                key={sig.name}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: `${String(rowPad)}px ${String(pad)}px`,
                  borderBottom: `1px solid ${ROW_BORDER}`,
                  gap: Math.round(scale * 3),
                }}
              >
                <span
                  style={{
                    fontSize: fs,
                    color: LABEL_FG,
                    flex: 1,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {sig.name.replace(/_/g, ' ')}
                </span>

                <div
                  style={{
                    width: barW,
                    height: barH,
                    background: BAR_TRACK,
                    borderRadius: 2,
                    flexShrink: 0,
                    overflow: 'hidden',
                  }}
                >
                  {pct !== null && (
                    <div
                      style={{
                        width: `${String(Math.round(pct * 100))}%`,
                        height: '100%',
                        background: barColor,
                        borderRadius: 2,
                        transition: 'width 0.25s linear',
                      }}
                    />
                  )}
                </div>

                <span
                  style={{
                    fontSize: fs,
                    color: valueColor,
                    fontVariantNumeric: 'tabular-nums',
                    minWidth: Math.round(scale * 18),
                    textAlign: 'right',
                    flexShrink: 0,
                  }}
                >
                  {valueStr}
                </span>

                <span
                  style={{
                    fontSize: fs - 1,
                    color: UNIT_FG,
                    minWidth: Math.round(scale * 10),
                    flexShrink: 0,
                  }}
                >
                  {sig.unit}
                </span>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
