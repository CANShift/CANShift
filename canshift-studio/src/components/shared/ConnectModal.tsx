// ConnectModal.tsx — USB connection popup triggered from the TopBar button

import { useEffect } from 'react'
import { useDeviceStore } from '../../stores/device.store'
import { useUsbConnection } from '../../hooks/useUsbConnection'
import { IconRefresh, IconDisconnect, IconUsb } from '../icons/Icon'

interface ConnectModalProps {
  onClose: () => void
}

const overlay: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 1000,
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'flex-end',
  paddingTop: 52,
  paddingRight: 12,
}

const panel: React.CSSProperties = {
  width: 300,
  background: '#1A1A1A',
  border: '1px solid #2A2A2A',
  borderRadius: 8,
  boxShadow: '0 8px 32px #00000099',
  overflow: 'hidden',
}

const selectStyle: React.CSSProperties = {
  flex: 1,
  padding: '5px 8px',
  background: '#111111',
  border: '1px solid #333333',
  borderRadius: 4,
  color: '#CCCCCC',
  fontSize: 12,
}

const btnBase: React.CSSProperties = {
  padding: '5px 12px',
  borderRadius: 4,
  fontSize: 12,
  cursor: 'pointer',
  border: '1px solid #333333',
  background: '#222222',
  color: '#CCCCCC',
}

export default function ConnectModal({ onClose }: ConnectModalProps) {
  const status = useDeviceStore((s) => s.status)
  const portPath = useDeviceStore((s) => s.portPath)
  const errorMessage = useDeviceStore((s) => s.errorMessage)
  const clearError = useDeviceStore((s) => s.clearError)

  const {
    ports,
    selectedPort,
    setSelectedPort,
    loading,
    connected,
    refreshPorts,
    connect,
    disconnect,
  } = useUsbConnection()

  // Refresh ports when the modal opens
  useEffect(() => {
    if (!connected) refreshPorts()
  }, [connected, refreshPorts])

  return (
    <>
      {/* Backdrop — click outside to close */}
      <div style={overlay} onClick={onClose}>
        <div
          style={panel}
          onClick={(e) => {
            e.stopPropagation()
          }}
        >
          {/* Header */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '10px 14px',
              borderBottom: '1px solid #222222',
            }}
          >
            <span
              style={{
                fontSize: 12,
                color: '#888888',
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
              }}
            >
              USB Device
            </span>
            <button
              onClick={onClose}
              style={{
                background: 'none',
                border: 'none',
                color: '#AAAAAA',
                cursor: 'pointer',
                fontSize: 16,
                lineHeight: 1,
              }}
            >
              ×
            </button>
          </div>

          <div style={{ padding: '14px 14px 16px' }}>
            {/* Status row */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                marginBottom: 14,
                padding: '8px 10px',
                background: '#111111',
                borderRadius: 6,
                border: '1px solid #222222',
              }}
            >
              <StatusDot status={status} />
              <div>
                <div style={{ fontSize: 12, color: statusColor(status) }}>
                  {statusLabel(status, portPath)}
                </div>
                {errorMessage && (
                  <div style={{ fontSize: 10, color: '#AA3333', marginTop: 2 }}>{errorMessage}</div>
                )}
              </div>
              {status === 'error' && (
                <button
                  onClick={() => {
                    clearError()
                  }}
                  style={{ ...btnBase, marginLeft: 'auto', padding: '3px 8px', fontSize: 10 }}
                >
                  Clear
                </button>
              )}
            </div>

            {/* Port selector — only when disconnected / error */}
            {!connected && (
              <>
                <div
                  style={{
                    fontSize: 10,
                    color: '#AAAAAA',
                    marginBottom: 6,
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                  }}
                >
                  Serial port
                </div>
                <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
                  <select
                    value={selectedPort}
                    onChange={(e) => {
                      setSelectedPort(e.target.value)
                    }}
                    style={selectStyle}
                  >
                    {ports.length === 0 ? (
                      <option value="">No ports found</option>
                    ) : (
                      <>
                        <option value="">Select port…</option>
                        {ports.map((p) => (
                          <option key={p.path} value={p.path}>
                            {p.path}
                            {p.manufacturer ? ` — ${p.manufacturer}` : ''}
                          </option>
                        ))}
                      </>
                    )}
                  </select>
                  <button
                    onClick={refreshPorts}
                    disabled={loading}
                    style={{ ...btnBase, display: 'flex', alignItems: 'center', gap: 4 }}
                  >
                    <IconRefresh size={12} color="currentColor" />
                  </button>
                </div>

                <button
                  onClick={connect}
                  disabled={!selectedPort || loading}
                  style={{
                    ...btnBase,
                    width: '100%',
                    padding: '7px 0',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                    background: selectedPort && !loading ? '#CC3333' : '#1A1A1A',
                    borderColor: selectedPort && !loading ? '#CC3333' : '#333333',
                    color: selectedPort && !loading ? '#FFFFFF' : '#AAAAAA',
                  }}
                >
                  <IconUsb size={13} color="currentColor" />
                  {loading ? 'Connecting…' : 'Connect'}
                </button>
              </>
            )}

            {/* Connected actions */}
            {connected && (
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={() => {
                    disconnect()
                    onClose()
                  }}
                  style={{
                    ...btnBase,
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                  }}
                >
                  <IconDisconnect size={12} color="currentColor" />
                  Disconnect
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function StatusDot({ status }: { status: string }) {
  const color =
    status === 'connected'
      ? '#44CC44'
      : status === 'burning'
        ? '#FF8800'
        : status === 'error'
          ? '#CC3333'
          : '#AAAAAA'

  return (
    <span
      style={{
        display: 'inline-block',
        width: 8,
        height: 8,
        borderRadius: '50%',
        background: color,
        flexShrink: 0,
        boxShadow: status !== 'disconnected' ? `0 0 6px ${color}88` : 'none',
      }}
    />
  )
}

function statusColor(status: string): string {
  if (status === 'connected') return '#55CC55'
  if (status === 'burning') return '#FF8800'
  if (status === 'error') return '#CC4444'
  return '#AAAAAA'
}

function statusLabel(status: string, portPath: string | null): string {
  if (status === 'connected') return `Connected${portPath ? ` · ${portPath}` : ''}`
  if (status === 'burning') return 'Syncing config…'
  if (status === 'error') return 'Error'
  return 'Not connected'
}
