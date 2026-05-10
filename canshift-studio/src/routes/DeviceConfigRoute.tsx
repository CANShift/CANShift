// DeviceConfigRoute.tsx — CAN bus and GPIO hardware configuration
//
// Settings are stored in userData/device.json. The firmware reads
// device.json at boot from SPIFFS and uses these values instead of the
// board_config.h compile-time defaults.

import { useState, useEffect, useCallback } from 'react'
import { deviceConfigIpc } from '../services/ipc.service'
import type { DeviceConfig, CanSpeedKbps } from '@tmbk/canshift-core'
import { DEFAULT_DEVICE_CONFIG, CAN_SPEED_OPTIONS } from '@tmbk/canshift-core'
import ReleaseInfoCard from '../components/shared/ReleaseInfoCard'

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

// The route is a flex child of `<div overflow:hidden>` in App.tsx so it has
// no scroll of its own. `scrollContainer` makes the page scrollable within
// the available height.
const scrollContainer: React.CSSProperties = {
  flex: 1,
  minHeight: 0,
  overflowY: 'auto',
}

const page: React.CSSProperties = {
  padding: '24px 24px 48px',
  maxWidth: 560,
  margin: '0 auto',
  color: '#CCCCCC',
  fontFamily: 'monospace',
}

const section: React.CSSProperties = {
  background: '#141414',
  border: '1px solid #222222',
  borderRadius: 8,
  padding: '16px 20px',
  marginBottom: 16,
}

const label: React.CSSProperties = {
  fontSize: 10,
  color: '#555555',
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  marginBottom: 6,
  display: 'block',
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '7px 10px',
  background: '#0D0D0D',
  border: '1px solid #2A2A2A',
  borderRadius: 4,
  color: '#CCCCCC',
  fontSize: 13,
  boxSizing: 'border-box',
}

const row: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: 12,
  marginBottom: 12,
}

const hint: React.CSSProperties = {
  fontSize: 11,
  color: '#444444',
  marginTop: 4,
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function DeviceConfigRoute() {
  const [config, setConfig] = useState<DeviceConfig>(DEFAULT_DEVICE_CONFIG)
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')

  useEffect(() => {
    void deviceConfigIpc.read().then((result) => {
      if (result.success && result.config) setConfig(result.config)
    })
  }, [])

  const handleSave = useCallback(async () => {
    setSaving(true)
    setSaveError('')
    const result = await deviceConfigIpc.write(config)
    setSaving(false)
    if (result.success) {
      setSaved(true)
      setTimeout(() => {
        setSaved(false)
      }, 2000)
    } else {
      setSaveError(result.error ?? 'Save failed')
    }
  }, [config])

  return (
    <div style={scrollContainer}>
      <div style={page}>
        <div style={{ fontSize: 16, fontWeight: 600, color: '#FFFFFF', marginBottom: 4 }}>
          Device Configuration
        </div>
        <div style={{ fontSize: 12, color: '#555555', marginBottom: 20 }}>
          Hardware settings applied at boot from{' '}
          <code style={{ color: '#777777' }}>/config/device.json</code>
        </div>

        {/* CAN Bus */}
        <div style={section}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#AAAAAA', marginBottom: 14 }}>
            CAN Bus
          </div>

          <div style={{ marginBottom: 12 }}>
            <span style={label}>Speed</span>
            <select
              value={config.can_speed_kbps}
              onChange={(e) => {
                setConfig((c) => ({
                  ...c,
                  can_speed_kbps: parseInt(e.target.value, 10) as CanSpeedKbps,
                }))
              }}
              style={inputStyle}
            >
              {CAN_SPEED_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s} kbps
                </option>
              ))}
            </select>
            <div style={hint}>Must match MaxxECU CAN output configuration</div>
          </div>

          <div style={row}>
            <div>
              <span style={label}>TWAI TX pin (GPIO)</span>
              <input
                type="number"
                min={0}
                max={39}
                value={config.twai_tx_pin}
                onChange={(e) => {
                  setConfig((c) => ({ ...c, twai_tx_pin: parseInt(e.target.value, 10) }))
                }}
                style={inputStyle}
              />
              <div style={hint}>CAN Pal CTX → ESP32</div>
            </div>
            <div>
              <span style={label}>TWAI RX pin (GPIO)</span>
              <input
                type="number"
                min={0}
                max={39}
                value={config.twai_rx_pin}
                onChange={(e) => {
                  setConfig((c) => ({ ...c, twai_rx_pin: parseInt(e.target.value, 10) }))
                }}
                style={inputStyle}
              />
              <div style={hint}>CAN Pal CRX → ESP32</div>
            </div>
          </div>

          <div
            style={{
              fontSize: 11,
              color: '#333333',
              borderTop: '1px solid #1E1E1E',
              paddingTop: 10,
              marginTop: 4,
            }}
          >
            Wiring: CAN Pal CTX → GPIO {config.twai_tx_pin} · CRX → GPIO {config.twai_rx_pin} ·
            CANH/CANL → MaxxECU · VCC → 5V
          </div>
        </div>

        {/* Save to userData */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 20 }}>
          <button
            onClick={() => {
              void handleSave()
            }}
            disabled={saving}
            style={{
              padding: '8px 20px',
              borderRadius: 4,
              fontSize: 12,
              fontWeight: 600,
              cursor: saving ? 'not-allowed' : 'pointer',
              border: 'none',
              background: saving ? '#332222' : '#CC3333',
              color: saving ? '#666666' : '#FFFFFF',
            }}
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
          {saved && <span style={{ fontSize: 12, color: '#44CC44' }}>Saved</span>}
          {saveError && <span style={{ fontSize: 12, color: '#CC3333' }}>{saveError}</span>}
        </div>

        {/* GitHub release info card (issue #571) */}
        <ReleaseInfoCard />
      </div>
    </div>
  )
}
