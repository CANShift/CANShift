// DeviceRoute.tsx — USB device connection and config sync

import { useEffect } from 'react'
import { useDeviceStore } from '../stores/device.store'
import { useDashboardStore } from '../stores/dashboard.store'
import { useLogStore } from '../stores/log.store'
import { usbService } from '../services/ipc.service'
import { useUsbConnection } from '../hooks/useUsbConnection'

const btn: React.CSSProperties = {
  padding: '6px 14px',
  background: '#1E1E1E',
  border: '1px solid #333333',
  borderRadius: 4,
  color: '#CCCCCC',
  cursor: 'pointer',
  fontSize: 13,
}

const primaryBtn: React.CSSProperties = {
  ...btn,
  background: '#CC3333',
  borderColor: '#CC3333',
  color: '#FFFFFF',
}

export default function DeviceRoute() {
  const status = useDeviceStore((s) => s.status)
  const portPath = useDeviceStore((s) => s.portPath)
  const syncing = useDeviceStore((s) => s.syncing)
  const errorMessage = useDeviceStore((s) => s.errorMessage)
  const firmwareVersion = useDeviceStore((s) => s.firmwareVersion)
  const setSyncing = useDeviceStore((s) => s.setSyncing)
  const setSyncComplete = useDeviceStore((s) => s.setSyncComplete)
  const setError = useDeviceStore((s) => s.setError)

  const config = useDashboardStore((s) => s.config)
  const isDirty = useDashboardStore((s) => s.isDirty)
  const log = useLogStore((s) => s.push)

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

  useEffect(() => {
    if (!connected) refreshPorts()
  }, [connected, refreshPorts])

  const handlePushConfig = () => {
    if (!config || !connected) return
    setSyncing(true)
    log('info', 'Pushing config to device…')
    usbService
      .pushConfig(config)
      .then((result) => {
        if (result.success) {
          setSyncComplete(new Date())
          log('success', 'Config pushed successfully')
        } else {
          const msg = result.error ?? 'Push failed'
          setError(msg)
          setSyncing(false)
          log('error', msg)
        }
      })
      .catch(() => {
        setError('Push error')
        setSyncing(false)
        log('error', 'Config push error')
      })
  }

  const handleReboot = () => {
    log('info', 'Rebooting device…')
    usbService.reboot().catch(() => {
      setError('Reboot failed')
      log('error', 'Reboot failed')
    })
  }

  return (
    <div style={{ flex: 1, padding: 28, maxWidth: 560, overflowY: 'auto' }}>
      <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 24, color: '#CCCCCC' }}>Device</h2>

      {/* Status banner */}
      <div
        style={{
          padding: '10px 14px',
          marginBottom: 20,
          background: connected ? '#0A1A0A' : '#1A1A1A',
          border: `1px solid ${connected ? '#335533' : status === 'error' ? '#552222' : '#2A2A2A'}`,
          borderRadius: 6,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}
      >
        <span
          style={{
            display: 'inline-block',
            width: 10,
            height: 10,
            borderRadius: '50%',
            flexShrink: 0,
            background:
              status === 'connected'
                ? '#44CC44'
                : status === 'burning'
                  ? '#FF8800'
                  : status === 'error'
                    ? '#CC3333'
                    : '#333333',
          }}
        />
        <div>
          <div
            style={{
              fontSize: 13,
              color: connected ? '#55CC55' : status === 'error' ? '#CC4444' : '#666666',
            }}
          >
            {status === 'connected' && `Connected — ${portPath ?? ''}`}
            {status === 'burning' && 'Syncing config to device…'}
            {status === 'error' && `Error — ${errorMessage ?? 'unknown'}`}
            {status === 'disconnected' && 'Not connected'}
          </div>
          {firmwareVersion && (
            <div style={{ fontSize: 11, color: '#445544' }}>Firmware {firmwareVersion}</div>
          )}
        </div>
      </div>

      {/* Port selection (disconnected) */}
      {!connected && (
        <section style={{ marginBottom: 20 }}>
          <label style={{ display: 'block', fontSize: 11, color: '#666666', marginBottom: 6 }}>
            Serial port
          </label>
          <div style={{ display: 'flex', gap: 8 }}>
            <select
              value={selectedPort}
              onChange={(e) => {
                setSelectedPort(e.target.value)
              }}
              style={{
                flex: 1,
                padding: '6px 10px',
                background: '#1A1A1A',
                border: '1px solid #333333',
                borderRadius: 4,
                color: ports.length ? '#CCCCCC' : '#AAAAAA',
                fontSize: 12,
              }}
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
            <button onClick={refreshPorts} disabled={loading} style={btn}>
              {loading ? '…' : 'Refresh'}
            </button>
          </div>
        </section>
      )}

      {/* Connect / disconnect */}
      <section style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        {!connected ? (
          <button
            onClick={connect}
            disabled={!selectedPort || loading}
            style={{ ...primaryBtn, opacity: !selectedPort || loading ? 0.4 : 1 }}
          >
            {loading ? 'Connecting…' : 'Connect'}
          </button>
        ) : (
          <>
            <button onClick={disconnect} style={btn}>
              Disconnect
            </button>
            <button onClick={handleReboot} style={btn}>
              Reboot Device
            </button>
          </>
        )}
      </section>

      {/* Push config */}
      {connected && (
        <section style={{ marginBottom: 20 }}>
          <h3 style={{ fontSize: 13, color: '#888888', marginBottom: 10 }}>Config Sync</h3>
          {!config && (
            <p style={{ fontSize: 12, color: '#AAAAAA', marginBottom: 8 }}>
              No config loaded. File → Open Config first.
            </p>
          )}
          {config && isDirty && (
            <p style={{ fontSize: 11, color: '#AA6600', marginBottom: 8 }}>
              ⚠ Unsaved changes — save before pushing
            </p>
          )}
          <button
            onClick={handlePushConfig}
            disabled={!config || syncing}
            style={{
              ...primaryBtn,
              opacity: !config || syncing ? 0.4 : 1,
              background: '#1A3A1A',
              borderColor: '#336633',
            }}
          >
            {syncing ? 'Pushing…' : 'Push Config to Device'}
          </button>
        </section>
      )}

      <div
        style={{
          marginTop: 28,
          padding: 12,
          background: '#141414',
          borderRadius: 6,
          fontSize: 11,
          color: '#AAAAAA',
          lineHeight: 1.7,
        }}
      >
        USB: 115 200 baud · newline-delimited JSON
        <br />
        Look for <strong style={{ color: '#AAAAAA' }}>CP210x</strong> or{' '}
        <strong style={{ color: '#AAAAAA' }}>CH340</strong>.
      </div>
    </div>
  )
}
