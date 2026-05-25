// SignalMapPanel.tsx — Side panel listing user-defined CAN signals.
//
// Displays all signals in useSignalMapperStore.
// Export button calls signalIpc.export() to write signals.json to disk.
// Remove button deletes a signal from the store.

import { useCallback } from 'react'
import { useSignalMapperStore } from '../../stores/signalMapper.store'
import { signalIpc } from '../../services/ipc.service'
import { CURRENT_SCHEMA_VERSION } from '@tmbk/canshift-core'
import type { SignalConfig } from '@tmbk/canshift-core'

const PANEL_WIDTH = 280

// Chrome shades not yet mapped to core design tokens. Hoisted as MIRROR consts
// per audit S-H-5 (umbrella #1015). `--text` is adopted inline below; the rest
// stay as mirrors pending design review.
const PANEL_BG = '#0D0D0D' // MIRROR: deepest chrome — between TopBar CHROME_BG (#0A0A0A) and --bg (#121212)
const PANEL_BORDER = '#1E1E1E' // MIRROR: ≈ --surface (#1F1F1F), chrome divider
const HEADER_LABEL = '#AAAAAA' // MIRROR: between --text-dim (#BABABA) and --text-muted (#8F8F8F)
const BTN_BORDER = '#2A2A2A' // MIRROR: ≈ --surface-2 (#292929)
const BTN_TEXT_ENABLED = '#666' // MIRROR: dimmer than --text-muted, clear/remove enabled label
const BTN_TEXT_DISABLED = '#333' // MIRROR: deepest dim, clear disabled label
const EXPORT_BG_ENABLED = '#CC3333' // MIRROR: dimmer red than --primary (#FF4747); matches ErrorBar ERR_ACCENT
const EXPORT_BG_DISABLED = '#2A2A2A' // MIRROR: matches BTN_BORDER
const EXPORT_TEXT_DISABLED = '#444' // MIRROR: deeper than --text-muted
const ROW_BORDER = '#161616' // MIRROR: between --bg (#121212) and --surface (#1F1F1F)
const SIGNAL_NAME_TEXT = '#CCCCCC' // MIRROR: between --text-dim and --text
const META_TEXT = '#555' // MIRROR: dim metadata + placeholder + remove icon

export default function SignalMapPanel(): React.ReactElement {
  const signals = useSignalMapperStore((s) => s.signals)
  const removeSignal = useSignalMapperStore((s) => s.removeSignal)
  const clearSignals = useSignalMapperStore((s) => s.clearSignals)

  const handleExport = useCallback(async () => {
    if (signals.length === 0) return
    const config: SignalConfig = {
      version: CURRENT_SCHEMA_VERSION,
      protocol: 'generic',
      canSpeedKbps: 500,
      signals,
    }
    await signalIpc.export(config)
  }, [signals])

  return (
    <div
      style={{
        width: PANEL_WIDTH,
        flexShrink: 0,
        background: PANEL_BG,
        borderLeft: `1px solid ${PANEL_BORDER}`,
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '10px 14px',
          borderBottom: `1px solid ${PANEL_BORDER}`,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          flexShrink: 0,
        }}
      >
        <span style={{ fontSize: 11, fontWeight: 600, color: HEADER_LABEL, flex: 1 }}>
          Signal map ({signals.length})
        </span>
        <button
          onClick={() => {
            if (signals.length > 0) clearSignals()
          }}
          disabled={signals.length === 0}
          title="Clear all"
          style={{
            padding: '3px 8px',
            borderRadius: 3,
            fontSize: 10,
            cursor: signals.length > 0 ? 'pointer' : 'not-allowed',
            border: `1px solid ${BTN_BORDER}`,
            background: 'transparent',
            color: signals.length > 0 ? BTN_TEXT_ENABLED : BTN_TEXT_DISABLED,
          }}
        >
          Clear
        </button>
        <button
          onClick={() => {
            void handleExport()
          }}
          disabled={signals.length === 0}
          style={{
            padding: '3px 10px',
            borderRadius: 3,
            fontSize: 10,
            fontWeight: 600,
            cursor: signals.length > 0 ? 'pointer' : 'not-allowed',
            border: 'none',
            background: signals.length > 0 ? EXPORT_BG_ENABLED : EXPORT_BG_DISABLED,
            color: signals.length > 0 ? 'hsl(var(--text))' : EXPORT_TEXT_DISABLED,
          }}
        >
          Export
        </button>
      </div>

      {/* Signal list */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {signals.length === 0 ? (
          <div
            style={{
              padding: '24px 14px',
              fontSize: 11,
              color: EXPORT_TEXT_DISABLED,
              textAlign: 'center',
              lineHeight: 1.6,
            }}
          >
            Click &ldquo;Define&rdquo; on a byte or pair in the interpreter to add a signal.
          </div>
        ) : (
          signals.map((sig) => (
            <div
              key={sig.name}
              style={{
                padding: '8px 14px',
                borderBottom: `1px solid ${ROW_BORDER}`,
                display: 'flex',
                flexDirection: 'column',
                gap: 3,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: SIGNAL_NAME_TEXT,
                    flex: 1,
                    minWidth: 0,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {sig.name}
                </span>
                <button
                  onClick={() => {
                    removeSignal(sig.name)
                  }}
                  title="Remove"
                  style={{
                    padding: '1px 6px',
                    borderRadius: 3,
                    fontSize: 10,
                    cursor: 'pointer',
                    border: `1px solid ${BTN_BORDER}`,
                    background: 'transparent',
                    color: META_TEXT,
                    flexShrink: 0,
                  }}
                >
                  ✕
                </button>
              </div>
              <div style={{ fontSize: 10, color: META_TEXT, fontFamily: 'monospace' }}>
                {sig.canFrameId} · b{sig.startByte}
                {sig.byteLength > 1 ? `–${String(sig.startByte + sig.byteLength - 1)}` : ''} ·{' '}
                {sig.bigEndian ? 'BE' : 'LE'} · {sig.signed ? 'int' : 'uint'}
                {String(sig.byteLength * 8)}
              </div>
              <div style={{ fontSize: 10, color: BTN_TEXT_ENABLED }}>
                ×{sig.scale}
                {sig.offset !== 0 ? ` +${String(sig.offset)}` : ''} {sig.unit ? sig.unit : ''}
                {' · '}
                {sig.min}–{sig.max}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
