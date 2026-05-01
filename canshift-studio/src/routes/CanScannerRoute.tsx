// CanScannerRoute.tsx — Live CAN bus signal scanner page.
//
// Sends CMD_CAN_SCAN_START (0x20) to the device, listens for raw frame batches
// over IPC, and displays a live table of discovered frame IDs with their
// last-seen bytes, frame count, and receive rate.

import { useEffect, useCallback } from 'react'
import { useCanScannerStore } from '../stores/canScanner.store'
import { canScannerIpc } from '../services/ipc.service'
import type { CanFrame } from '../services/ipc.service'
import { IpcChannels } from '../../main/ipc/ipc-channels'
import { IconRefresh, IconClear } from '../components/icons/Icon'

// ---------------------------------------------------------------------------
// Hex helpers
// ---------------------------------------------------------------------------

function toHex(n: number, width: number): string {
  return n.toString(16).toUpperCase().padStart(width, '0')
}

function bytesToHex(bytes: number[]): string {
  return bytes.map((b) => toHex(b, 2)).join(' ')
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function CanScannerRoute() {
  const scanning = useCanScannerStore((s) => s.scanning)
  const frames = useCanScannerStore((s) => s.frames)
  const setScanningState = useCanScannerStore((s) => s.setScanningState)
  const ingestBatch = useCanScannerStore((s) => s.ingestBatch)
  const clearFrames = useCanScannerStore((s) => s.clearFrames)

  const sorted = Object.values(frames).sort((a, b) => a.id - b.id)

  // Subscribe to CAN frame batches pushed from main process
  useEffect(() => {
    const handler = (...args: unknown[]): void => {
      ingestBatch(args[0] as CanFrame[])
    }
    window.ipc.on(IpcChannels.CAN_FRAME_BATCH, handler)
    return () => {
      window.ipc.off(IpcChannels.CAN_FRAME_BATCH, handler)
    }
  }, [ingestBatch])

  const handleToggle = useCallback(async () => {
    if (scanning) {
      await canScannerIpc.stop()
      setScanningState(false)
    } else {
      clearFrames()
      const result = await canScannerIpc.start()
      if (result.success) setScanningState(true)
    }
  }, [scanning, setScanningState, clearFrames])

  // Stop scan on unmount
  useEffect(() => {
    return () => {
      if (useCanScannerStore.getState().scanning) {
        void canScannerIpc.stop()
        useCanScannerStore.getState().setScanningState(false)
      }
    }
  }, [])

  return (
    <div
      style={{
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: '#111111',
        overflow: 'hidden',
      }}
    >
      {/* Toolbar */}
      <div
        style={{
          padding: '10px 16px',
          borderBottom: '1px solid #1E1E1E',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          flexShrink: 0,
        }}
      >
        <button
          onClick={() => void handleToggle()}
          style={{
            padding: '5px 14px',
            borderRadius: 4,
            fontSize: 12,
            fontWeight: 600,
            cursor: 'pointer',
            border: 'none',
            background: scanning ? '#443300' : '#CC3333',
            color: scanning ? '#FFAA00' : '#FFFFFF',
          }}
        >
          {scanning ? 'Stop scan' : 'Start scan'}
        </button>

        <button
          onClick={() => {
            clearFrames()
          }}
          disabled={scanning || sorted.length === 0}
          title="Clear"
          style={{
            padding: '5px 10px',
            borderRadius: 4,
            fontSize: 12,
            cursor: scanning || sorted.length === 0 ? 'not-allowed' : 'pointer',
            border: '1px solid #2A2A2A',
            background: 'transparent',
            color: scanning || sorted.length === 0 ? '#444444' : '#888888',
            display: 'flex',
            alignItems: 'center',
            gap: 5,
          }}
        >
          <IconClear size={12} />
          Clear
        </button>

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          {scanning && (
            <span
              style={{
                display: 'inline-block',
                width: 7,
                height: 7,
                borderRadius: '50%',
                background: '#FF4444',
                animation: 'pulse 1s infinite',
              }}
            />
          )}
          <span style={{ fontSize: 11, color: '#555555' }}>
            {sorted.length} frame ID{sorted.length !== 1 ? 's' : ''} discovered
          </span>
          <button
            onClick={() => {
              clearFrames()
            }}
            disabled={scanning || sorted.length === 0}
            title="Refresh — clear and restart"
            style={{
              padding: 4,
              borderRadius: 4,
              cursor: scanning || sorted.length === 0 ? 'not-allowed' : 'pointer',
              border: '1px solid #1E1E1E',
              background: 'transparent',
              color: '#444444',
              display: 'flex',
            }}
          >
            <IconRefresh size={12} />
          </button>
        </div>
      </div>

      {/* Table */}
      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
        {sorted.length === 0 ? (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 10,
              pointerEvents: 'none',
            }}
          >
            <span style={{ fontSize: 32, opacity: 0.4 }}>📡</span>
            <span style={{ fontSize: 13, color: '#888888' }}>
              {scanning ? 'Listening for CAN frames…' : 'Press Start scan to begin'}
            </span>
          </div>
        ) : (
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: 11,
              fontFamily: 'monospace',
            }}
          >
            <thead>
              <tr
                style={{
                  background: '#0D0D0D',
                  borderBottom: '1px solid #1E1E1E',
                  position: 'sticky',
                  top: 0,
                }}
              >
                {['ID (hex)', 'DLC', 'Data', 'Count', 'Rate (fps)', 'Last seen'].map((h) => (
                  <th
                    key={h}
                    style={{
                      padding: '6px 12px',
                      textAlign: 'left',
                      color: '#555555',
                      fontWeight: 600,
                      letterSpacing: '0.06em',
                      textTransform: 'uppercase',
                      fontSize: 9,
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map((entry) => (
                <tr
                  key={entry.id}
                  style={{
                    borderBottom: '1px solid #161616',
                    transition: 'background 0.2s',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = '#1A1A1A'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent'
                  }}
                >
                  <td style={{ padding: '5px 12px', color: '#FF8888', fontWeight: 700 }}>
                    {toHex(entry.id, entry.id > 0x7ff ? 8 : 3)}
                  </td>
                  <td style={{ padding: '5px 12px', color: '#888888' }}>{entry.dlc}</td>
                  <td style={{ padding: '5px 12px', color: '#CCCCCC', letterSpacing: '0.1em' }}>
                    {bytesToHex(entry.data)}
                  </td>
                  <td style={{ padding: '5px 12px', color: '#666666' }}>
                    {entry.count.toLocaleString()}
                  </td>
                  <td
                    style={{
                      padding: '5px 12px',
                      color: entry.rate > 100 ? '#FFAA00' : '#666666',
                    }}
                  >
                    {entry.rate}
                  </td>
                  <td style={{ padding: '5px 12px', color: '#444444' }}>
                    {new Date(entry.lastSeen).toLocaleTimeString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.2; }
        }
      `}</style>
    </div>
  )
}
