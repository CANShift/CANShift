// DeviceRoute.tsx — USB device connection and config sync
//
// Phase 1 priority: this view is the core USB workflow.

import { useState, useEffect } from 'react'
import { useDeviceStore } from '../stores/device.store'
import { useDashboardStore } from '../stores/dashboard.store'

interface PortInfo {
  path: string
  manufacturer?: string
  serialNumber?: string
}

export default function DeviceRoute() {
  const [ports, setPorts] = useState<PortInfo[]>([])
  const [selectedPort, setSelectedPort] = useState<string>('')
  const [statusMsg, setStatusMsg] = useState<string>('')

  const connected = useDeviceStore((s) => s.connected)
  const syncing = useDeviceStore((s) => s.syncing)
  const setConnected = useDeviceStore((s) => s.setConnected)
  const setSyncing = useDeviceStore((s) => s.setSyncing)
  const setSyncComplete = useDeviceStore((s) => s.setSyncComplete)

  const config = useDashboardStore((s) => s.config)

  const refreshPorts = () => {
    // TODO: Call window.ipc.invoke(IpcChannels.USB_LIST_PORTS)
    setStatusMsg('Port listing — IPC bridge TODO')
    setPorts([
      // Placeholder until IPC is wired
      { path: '/dev/tty.usbserial-0001', manufacturer: 'Silicon Labs' },
    ])
  }

  useEffect(() => {
    refreshPorts()
  }, [])

  const handleConnect = () => {
    if (!selectedPort) return
    // TODO: window.ipc.invoke(IpcChannels.USB_CONNECT, selectedPort)
    setConnected(true, selectedPort)
    setStatusMsg(`Connected to ${selectedPort}`)
  }

  const handleDisconnect = () => {
    // TODO: window.ipc.invoke(IpcChannels.USB_DISCONNECT)
    setConnected(false)
    setStatusMsg('Disconnected')
  }

  const handlePushConfig = () => {
    if (!config || !connected) return
    setSyncing(true)
    setStatusMsg('Pushing config to device...')
    // TODO: window.ipc.invoke(IpcChannels.USB_PUSH_CONFIG, config)
    setTimeout(() => {
      setSyncComplete(new Date())
      setStatusMsg('Config pushed successfully')
    }, 1000)
  }

  return (
    <div style={{ flex: 1, padding: 24, maxWidth: 600 }}>
      <h2 style={{ marginBottom: 24, fontSize: 18, fontWeight: 600 }}>Device Connection</h2>

      {/* Port selection */}
      <section style={{ marginBottom: 24 }}>
        <label style={{ display: 'block', fontSize: 12, color: '#888888', marginBottom: 6 }}>
          Serial Port
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
              background: '#1E1E1E',
              border: '1px solid #333333',
              borderRadius: 4,
              color: '#FFFFFF',
            }}
          >
            <option value="">Select port...</option>
            {ports.map((p) => (
              <option key={p.path} value={p.path}>
                {p.path} {p.manufacturer ? `(${p.manufacturer})` : ''}
              </option>
            ))}
          </select>
          <button onClick={refreshPorts} style={btnStyle}>
            Refresh
          </button>
        </div>
      </section>

      {/* Connection controls */}
      <section style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        {!connected ? (
          <button
            onClick={handleConnect}
            disabled={!selectedPort}
            style={{ ...btnStyle, background: '#FF4444', color: '#FFF' }}
          >
            Connect
          </button>
        ) : (
          <button onClick={handleDisconnect} style={btnStyle}>
            Disconnect
          </button>
        )}
      </section>

      {/* Sync controls */}
      {connected && (
        <section style={{ marginBottom: 24 }}>
          <h3 style={{ marginBottom: 12, fontSize: 14 }}>Config Sync</h3>
          <button
            onClick={handlePushConfig}
            disabled={!config || syncing}
            style={{ ...btnStyle, background: '#1A4A1A', color: syncing ? '#555' : '#FFF' }}
          >
            {syncing ? 'Pushing...' : 'Push Config to Device'}
          </button>
          {!config && (
            <p style={{ marginTop: 8, fontSize: 12, color: '#555555' }}>
              Load a config first (File → Open Config)
            </p>
          )}
        </section>
      )}

      {/* Status */}
      {statusMsg && <p style={{ fontSize: 12, color: '#888888', padding: '8px 0' }}>{statusMsg}</p>}

      <section style={{ marginTop: 24, padding: 12, background: '#1A1A1A', borderRadius: 4 }}>
        <p style={{ fontSize: 11, color: '#555555', lineHeight: 1.6 }}>
          Phase 1 USB workflow: 1. Connect the ESP32 via USB 2. Select the serial port (usually the
          Silicon Labs CP210x port) 3. Push config — the firmware reloads the config instantly
          <br />
          <br />
          Note: IPC bridge to Electron main process is not yet fully wired. See{' '}
          <code>main/services/usb.service.ts</code> and <code>main/ipc/ipc-handlers.ts</code>.
        </p>
      </section>
    </div>
  )
}

const btnStyle: React.CSSProperties = {
  padding: '6px 14px',
  background: '#2A2A2A',
  border: '1px solid #333333',
  borderRadius: 4,
  color: '#CCCCCC',
  cursor: 'pointer',
  fontSize: 13,
}
