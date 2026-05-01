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

export default function SignalMapPanel(): React.ReactElement {
  const signals = useSignalMapperStore((s) => s.signals)
  const removeSignal = useSignalMapperStore((s) => s.removeSignal)
  const clearSignals = useSignalMapperStore((s) => s.clearSignals)

  const handleExport = useCallback(async () => {
    if (signals.length === 0) return
    const config: SignalConfig = {
      version: CURRENT_SCHEMA_VERSION,
      protocol: 'maxxecu_v1.2',
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
        background: '#0D0D0D',
        borderLeft: '1px solid #1E1E1E',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '10px 14px',
          borderBottom: '1px solid #1E1E1E',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          flexShrink: 0,
        }}
      >
        <span style={{ fontSize: 11, fontWeight: 600, color: '#AAAAAA', flex: 1 }}>
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
            border: '1px solid #2A2A2A',
            background: 'transparent',
            color: signals.length > 0 ? '#666' : '#333',
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
            background: signals.length > 0 ? '#CC3333' : '#2A2A2A',
            color: signals.length > 0 ? '#FFFFFF' : '#444',
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
              color: '#444',
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
                borderBottom: '1px solid #161616',
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
                    color: '#CCCCCC',
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
                    border: '1px solid #2A2A2A',
                    background: 'transparent',
                    color: '#555',
                    flexShrink: 0,
                  }}
                >
                  ✕
                </button>
              </div>
              <div style={{ fontSize: 10, color: '#555', fontFamily: 'monospace' }}>
                {sig.canFrameId} · b{sig.startByte}
                {sig.byteLength > 1 ? `–${String(sig.startByte + sig.byteLength - 1)}` : ''} ·{' '}
                {sig.bigEndian ? 'BE' : 'LE'} · {sig.signed ? 'int' : 'uint'}
                {String(sig.byteLength * 8)}
              </div>
              <div style={{ fontSize: 10, color: '#666' }}>
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
