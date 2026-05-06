// DeviceConfigRoute.tsx — CAN bus and GPIO hardware configuration
//
// Settings are stored in userData/device.json and written to the SD card
// during SD preparation. The firmware reads device.json at boot and uses
// these values instead of the board_config.h compile-time defaults.

import { useState, useEffect, useCallback } from 'react'
import { deviceConfigIpc, sdIpc } from '../services/ipc.service'
import type { SdVolume, SdPushProgress } from '../services/ipc.service'
import type { DeviceConfig, CanSpeedKbps } from '@tmbk/canshift-core'
import { DEFAULT_DEVICE_CONFIG, CAN_SPEED_OPTIONS } from '@tmbk/canshift-core'
import { useDeviceStore } from '../stores/device.store'

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

  // "Prepare full SD" copies fonts + dashboard.json + signals.json from sd_contents/
  const [prepState, setPrepState] = useState<'idle' | 'copying' | 'done' | 'error'>('idle')
  const [prepError, setPrepError] = useState('')
  const [prepResult, setPrepResult] = useState<{ copied: number; skipped: number } | null>(null)
  // Force-refresh overwrites configs in /Volumes/SD/config/ — destructive,
  // gated by the confirmation modal below.
  const [forceRefresh, setForceRefresh] = useState(false)
  const [confirmForce, setConfirmForce] = useState(false)

  // "Push SD over USB" — same payload, but streamed to the connected board
  // through the existing serial link instead of a mounted volume.
  const connected = useDeviceStore((s) => s.connected)
  const [pushState, setPushState] = useState<'idle' | 'pushing' | 'done' | 'error'>('idle')
  const [pushError, setPushError] = useState('')
  const [pushProgress, setPushProgress] = useState<SdPushProgress | null>(null)
  const [pushResult, setPushResult] = useState<{ copied: number; skipped: number } | null>(null)

  useEffect(() => {
    void deviceConfigIpc.read().then((result) => {
      if (result.success && result.config) setConfig(result.config)
    })
    // Pre-fill the volume dropdown so the user doesn't have to click "Scan"
    // every time. handleScanVolumes already auto-selects when there's exactly
    // one removable volume.
    void sdIpc.listVolumes().then((vols) => {
      setSdVolumes(vols)
      if (vols.length === 1 && vols[0]) setSelectedVolume(vols[0].path)
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

  const handlePrepareSD = useCallback(async () => {
    if (!selectedVolume) return
    setPrepState('copying')
    setPrepError('')
    setPrepResult(null)
    const result = await sdIpc.prepare(selectedVolume, forceRefresh)
    if (result.success) {
      setPrepResult({ copied: result.copied.length, skipped: result.skipped.length })
      setPrepState('done')
    } else {
      setPrepError(result.error ?? 'Prepare failed')
      setPrepState('error')
    }
  }, [selectedVolume, forceRefresh])

  const handlePrepareClick = useCallback(() => {
    if (forceRefresh) {
      setConfirmForce(true)
      return
    }
    void handlePrepareSD()
  }, [forceRefresh, handlePrepareSD])

  const handleConfirmForce = useCallback(() => {
    setConfirmForce(false)
    void handlePrepareSD()
  }, [handlePrepareSD])

  const handlePushOverUsb = useCallback(async () => {
    setPushState('pushing')
    setPushError('')
    setPushProgress(null)
    setPushResult(null)

    const unsubscribe = sdIpc.onPushProgress(setPushProgress)
    try {
      const result = await sdIpc.pushOverUsb()
      if (result.success) {
        setPushResult({ copied: result.copied.length, skipped: result.skipped.length })
        setPushState('done')
      } else {
        setPushError(result.error ?? 'Push failed')
        setPushState('error')
      }
    } finally {
      unsubscribe()
      setPushProgress(null)
    }
  }, [])

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

      {/* Prepare full SD card */}
      <div style={section}>
        <div style={{ fontSize: 12, fontWeight: 600, color: '#AAAAAA', marginBottom: 12 }}>
          Prepare SD card (full)
        </div>
        <div style={{ fontSize: 11, color: '#555555', marginBottom: 12 }}>
          Copies fonts, default dashboard and signals to the selected volume. Required after a fresh
          flash — without this, the screen stays black.
        </div>
        <div style={{ fontSize: 11, color: '#7B5500', marginBottom: 12 }}>
          Eject the SD card from the CrowPanel, insert it into your Mac, then click below.
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

        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            fontSize: 11,
            color: '#888888',
            marginBottom: 10,
            cursor: 'pointer',
          }}
        >
          <input
            type="checkbox"
            checked={forceRefresh}
            onChange={(e) => {
              setForceRefresh(e.target.checked)
            }}
          />
          Force refresh — also overwrite <code style={{ color: '#AAAAAA' }}>/config/</code>{' '}
          (dashboard, signals, theme)
        </label>

        <button
          onClick={handlePrepareClick}
          disabled={!selectedVolume || prepState === 'copying'}
          style={{
            padding: '7px 20px',
            borderRadius: 4,
            fontSize: 12,
            fontWeight: 600,
            cursor: !selectedVolume || prepState === 'copying' ? 'not-allowed' : 'pointer',
            border: 'none',
            background: !selectedVolume || prepState === 'copying' ? '#332222' : '#CC3333',
            color: !selectedVolume || prepState === 'copying' ? '#666666' : '#FFFFFF',
          }}
        >
          {prepState === 'copying'
            ? 'Copying…'
            : forceRefresh
              ? 'Prepare SD card (force)'
              : 'Prepare SD card'}
        </button>

        {prepState === 'done' && prepResult && (
          <div style={{ fontSize: 12, color: '#44CC44', marginTop: 8 }}>
            ✓ {prepResult.copied} file{prepResult.copied !== 1 ? 's' : ''} copied
            {prepResult.skipped > 0
              ? ` · ${String(prepResult.skipped)} skipped (user data preserved)`
              : ''}{' '}
            — reinsert the card into the CrowPanel and reboot
          </div>
        )}
        {prepState === 'error' && (
          <div style={{ fontSize: 12, color: '#CC3333', marginTop: 8 }}>{prepError}</div>
        )}
      </div>

      {/* Push SD over USB (no card removal) */}
      <div style={section}>
        <div style={{ fontSize: 12, fontWeight: 600, color: '#AAAAAA', marginBottom: 12 }}>
          Push SD over USB
        </div>
        <div style={{ fontSize: 11, color: '#555555', marginBottom: 12 }}>
          Streams fonts and assets directly to the SD card while it stays plugged into the board.
          User configuration in <code style={{ color: '#777777' }}>/config/</code> is left untouched
          — use the dashboard editor to push that.
        </div>

        <button
          onClick={() => {
            void handlePushOverUsb()
          }}
          disabled={!connected || pushState === 'pushing'}
          style={{
            padding: '7px 20px',
            borderRadius: 4,
            fontSize: 12,
            fontWeight: 600,
            cursor: !connected || pushState === 'pushing' ? 'not-allowed' : 'pointer',
            border: 'none',
            background: !connected || pushState === 'pushing' ? '#332222' : '#CC3333',
            color: !connected || pushState === 'pushing' ? '#666666' : '#FFFFFF',
          }}
        >
          {pushState === 'pushing' ? 'Pushing…' : 'Push to board'}
        </button>

        {!connected && (
          <span style={{ fontSize: 11, color: '#555555', marginLeft: 10 }}>
            Connect a device first.
          </span>
        )}

        {pushState === 'pushing' && pushProgress && (
          <div style={{ fontSize: 12, color: '#888888', marginTop: 8 }}>
            {pushProgress.fileIndex + 1} / {pushProgress.totalFiles} ·{' '}
            <code style={{ color: '#AAAAAA' }}>{pushProgress.relPath}</code>
          </div>
        )}

        {pushState === 'done' && pushResult && (
          <div style={{ fontSize: 12, color: '#44CC44', marginTop: 8 }}>
            ✓ {pushResult.copied} file{pushResult.copied !== 1 ? 's' : ''} written
            {pushResult.skipped > 0
              ? ` · ${String(pushResult.skipped)} skipped (config preserved)`
              : ''}{' '}
            — reboot the board to load the new content
          </div>
        )}
        {pushState === 'error' && (
          <div style={{ fontSize: 12, color: '#CC3333', marginTop: 8 }}>{pushError}</div>
        )}
      </div>

      {confirmForce && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
          onClick={() => {
            setConfirmForce(false)
          }}
        >
          <div
            onClick={(e) => {
              e.stopPropagation()
            }}
            style={{
              background: '#1A1A1A',
              border: '1px solid #333333',
              borderRadius: 8,
              padding: 24,
              maxWidth: 460,
              color: '#CCCCCC',
              fontFamily: 'monospace',
            }}
          >
            <div style={{ fontSize: 14, fontWeight: 600, color: '#FFFFFF', marginBottom: 12 }}>
              Force refresh?
            </div>
            <div style={{ fontSize: 12, lineHeight: 1.5, marginBottom: 20, color: '#999999' }}>
              This will overwrite <code style={{ color: '#FFFFFF' }}>dashboard.json</code>,{' '}
              <code style={{ color: '#FFFFFF' }}>signals.json</code>, and{' '}
              <code style={{ color: '#FFFFFF' }}>theme.json</code> on the SD card. Any local edits
              you made on the device will be lost.
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button
                onClick={() => {
                  setConfirmForce(false)
                }}
                style={{
                  padding: '7px 16px',
                  borderRadius: 4,
                  fontSize: 12,
                  cursor: 'pointer',
                  border: '1px solid #333333',
                  background: 'transparent',
                  color: '#AAAAAA',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmForce}
                style={{
                  padding: '7px 16px',
                  borderRadius: 4,
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                  border: 'none',
                  background: '#CC3333',
                  color: '#FFFFFF',
                }}
              >
                Overwrite
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
