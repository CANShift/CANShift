// DeviceConfigRoute.tsx — CAN bus and GPIO hardware configuration
//
// Settings are stored in userData/device.json and written to the SD card
// during SD preparation. The firmware reads device.json at boot and uses
// these values instead of the board_config.h compile-time defaults.

import { useState, useEffect, useCallback } from 'react'
import { deviceConfigIpc, sdIpc } from '../services/ipc.service'
import type { SdVolume } from '../services/ipc.service'
import type { DeviceConfig, CanSpeedKbps } from '@tmbk/canshift-core'
import { DEFAULT_DEVICE_CONFIG, CAN_SPEED_OPTIONS } from '@tmbk/canshift-core'

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const page: React.CSSProperties = {
  padding: 24,
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

  const [sdVolumes, setSdVolumes] = useState<SdVolume[]>([])
  const [selectedVolume, setSelectedVolume] = useState('')
  const [sdState, setSdState] = useState<'idle' | 'writing' | 'done' | 'error'>('idle')
  const [sdError, setSdError] = useState('')

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

  const handleScanVolumes = useCallback(() => {
    void sdIpc.listVolumes().then((vols) => {
      setSdVolumes(vols)
      if (vols.length === 1 && vols[0]) setSelectedVolume(vols[0].path)
    })
  }, [])

  const handleWriteToSD = useCallback(async () => {
    if (!selectedVolume) return
    setSdState('writing')
    setSdError('')

    // Write device.json directly to the SD config folder
    const result = await deviceConfigIpc.writeToSD(selectedVolume, config)
    if (result.success) {
      setSdState('done')
    } else {
      setSdError(result.error ?? 'Write failed')
      setSdState('error')
    }
  }, [selectedVolume, config])

  return (
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

      {/* Write to SD */}
      <div style={section}>
        <div style={{ fontSize: 12, fontWeight: 600, color: '#AAAAAA', marginBottom: 12 }}>
          Write to SD card
        </div>
        <div style={{ fontSize: 11, color: '#555555', marginBottom: 12 }}>
          Writes <code style={{ color: '#666666' }}>device.json</code> directly to the selected
          volume. Firmware reads it on next boot.
        </div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
          <select
            value={selectedVolume}
            onChange={(e) => {
              setSelectedVolume(e.target.value)
            }}
            style={{ ...inputStyle, flex: 1 }}
          >
            <option value="">— select volume —</option>
            {sdVolumes.map((v) => (
              <option key={v.path} value={v.path}>
                {v.label}
              </option>
            ))}
          </select>
          <button
            onClick={handleScanVolumes}
            style={{
              padding: '7px 14px',
              borderRadius: 4,
              fontSize: 12,
              cursor: 'pointer',
              border: '1px solid #333333',
              background: 'transparent',
              color: '#888888',
            }}
          >
            Scan
          </button>
        </div>

        <button
          onClick={() => {
            void handleWriteToSD()
          }}
          disabled={!selectedVolume || sdState === 'writing'}
          style={{
            padding: '7px 20px',
            borderRadius: 4,
            fontSize: 12,
            fontWeight: 600,
            cursor: !selectedVolume || sdState === 'writing' ? 'not-allowed' : 'pointer',
            border: 'none',
            background: !selectedVolume || sdState === 'writing' ? '#332222' : '#CC3333',
            color: !selectedVolume || sdState === 'writing' ? '#666666' : '#FFFFFF',
          }}
        >
          {sdState === 'writing' ? 'Writing…' : 'Write to SD'}
        </button>

        {sdState === 'done' && (
          <div style={{ fontSize: 12, color: '#44CC44', marginTop: 8 }}>
            device.json written — reboot the device to apply
          </div>
        )}
        {sdState === 'error' && (
          <div style={{ fontSize: 12, color: '#CC3333', marginTop: 8 }}>{sdError}</div>
        )}
      </div>
    </div>
  )
}
