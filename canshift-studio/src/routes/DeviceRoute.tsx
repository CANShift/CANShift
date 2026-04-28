// DeviceRoute.tsx — USB device connection and config sync

import { useState, useEffect, useCallback } from 'react'
import { useDeviceStore } from '../stores/device.store'
import { useDashboardStore } from '../stores/dashboard.store'
import { usbService } from '../services/ipc.service'
import type { PortInfo } from '../services/ipc.service'

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
  const [ports, setPorts] = useState<PortInfo[]>([])
  const [selectedPort, setSelectedPort] = useState<string>('')
  const [statusMsg, setStatusMsg] = useState<string>('')
  const [loading, setLoading] = useState(false)

  const connected = useDeviceStore((s) => s.connected)
  const portPath = useDeviceStore((s) => s.portPath)
  const syncing = useDeviceStore((s) => s.syncing)
  const firmwareVersion = useDeviceStore((s) => s.firmwareVersion)
  const setConnected = useDeviceStore((s) => s.setConnected)
  const setSyncing = useDeviceStore((s) => s.setSyncing)
  const setSyncComplete = useDeviceStore((s) => s.setSyncComplete)

  const config = useDashboardStore((s) => s.config)
  const isDirty = useDashboardStore((s) => s.isDirty)

  const refreshPorts = useCallback(() => {
    setLoading(true)
    usbService
      .listPorts()
      .then((list) => {
        setPorts(list)
        if (list.length === 1 && list[0]) setSelectedPort(list[0].path)
        if (list.length === 0) setStatusMsg('No serial ports found')
        else setStatusMsg(`${list.length.toString()} port${list.length > 1 ? 's' : ''} found`)
      })
      .catch(() => {
        setStatusMsg('Failed to list ports')
      })
      .finally(() => {
        setLoading(false)
      })
  }, [])

  useEffect(() => {
    refreshPorts()
  }, [refreshPorts])

  const handleConnect = () => {
    if (!selectedPort) return
    setLoading(true)
    usbService
      .connect(selectedPort)
      .then((result) => {
        if (result.success) {
          setConnected(true, selectedPort)
          setStatusMsg(`Connected to ${selectedPort}`)
        } else {
          setStatusMsg(`Connect failed: ${result.error ?? 'unknown error'}`)
        }
      })
      .catch(() => {
        setStatusMsg('Connection error')
      })
      .finally(() => {
        setLoading(false)
      })
  }

  const handleDisconnect = () => {
    usbService
      .disconnect()
      .then(() => {
        setConnected(false)
        setStatusMsg('Disconnected')
      })
      .catch(() => {
        setConnected(false)
      })
  }

  const handlePushConfig = () => {
    if (!config || !connected) return
    setSyncing(true)
    setStatusMsg('Pushing config to device…')
    usbService
      .pushConfig(config)
      .then((result) => {
        if (result.success) {
          setSyncComplete(new Date())
          setStatusMsg('Config pushed — device reloading')
        } else {
          setSyncing(false)
          setStatusMsg(`Push failed: ${result.error ?? 'unknown error'}`)
        }
      })
      .catch(() => {
        setSyncing(false)
        setStatusMsg('Push error')
      })
  }

  const handleReboot = () => {
    usbService
      .reboot()
      .then(() => {
        setStatusMsg('Reboot command sent')
      })
      .catch(() => {
        setStatusMsg('Reboot failed')
      })
  }

  return (
    <div style={{ flex: 1, padding: 28, maxWidth: 560, overflowY: 'auto' }}>
      <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 24, color: '#CCCCCC' }}>
        Device Connection
      </h2>

      {/* Connection status banner */}
      <div
        style={{
          padding: '10px 14px',
          marginBottom: 20,
          background: connected ? '#0A1A0A' : '#1A1A1A',
          border: `1px solid ${connected ? '#335533' : '#2A2A2A'}`,
          borderRadius: 6,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}
      >
        <span style={{ fontSize: 16, color: connected ? '#44AA44' : '#444444' }}>
          {connected ? '●' : '○'}
        </span>
        <div>
          <div style={{ fontSize: 13, color: connected ? '#55CC55' : '#666666' }}>
            {connected ? `Connected — ${portPath ?? ''}` : 'Not connected'}
          </div>
          {firmwareVersion && (
            <div style={{ fontSize: 11, color: '#445544' }}>Firmware {firmwareVersion}</div>
          )}
        </div>
      </div>

      {/* Port selection */}
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
                color: ports.length ? '#CCCCCC' : '#555555',
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
            onClick={handleConnect}
            disabled={!selectedPort || loading}
            style={{ ...primaryBtn, opacity: !selectedPort || loading ? 0.4 : 1 }}
          >
            Connect
          </button>
        ) : (
          <>
            <button onClick={handleDisconnect} style={btn}>
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
            <p style={{ fontSize: 12, color: '#555555', marginBottom: 8 }}>
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

      {/* Status message */}
      {statusMsg && (
        <p style={{ fontSize: 12, color: '#666666', marginTop: 12, fontStyle: 'italic' }}>
          {statusMsg}
        </p>
      )}

      {/* Info */}
      <div
        style={{
          marginTop: 28,
          padding: 12,
          background: '#141414',
          borderRadius: 6,
          fontSize: 11,
          color: '#444444',
          lineHeight: 1.7,
        }}
      >
        USB protocol: 115 200 baud · newline-delimited JSON
        <br />
        Look for the <strong style={{ color: '#555555' }}>Silicon Labs CP210x</strong> or{' '}
        <strong style={{ color: '#555555' }}>CH340</strong> port.
        <br />
        The firmware reloads the config immediately on receive.
      </div>
    </div>
  )
}
