// ScreenSettingsPanel.tsx — Full-canvas overlay page for physical screen settings.
// Rendered inside the 320×240 canvas widget area, simulating an on-device settings page.
// Closed exclusively via swipe-down gesture in the top bar.

import { useState } from 'react'
import { useScreenSettingsStore } from '../../stores/screenSettings.store'
import { useDeviceStore } from '../../stores/device.store'
import { useLogStore } from '../../stores/log.store'
import { usbService } from '../../services/ipc.service'

interface ScreenSettingsPanelProps {
  scale: number
}

export default function ScreenSettingsPanel({ scale }: ScreenSettingsPanelProps) {
  const { brightness, contrast, sleepTimeoutS, rotation, set, reset } = useScreenSettingsStore()
  const connected = useDeviceStore((s) => s.connected)
  const simulationMode = useDeviceStore((s) => s.simulationMode)
  const log = useLogStore((s) => s.push)
  const [otaState, setOtaState] = useState<'idle' | 'pending'>('idle')

  const fs = Math.round(scale * 6)
  const fsLg = Math.round(scale * 7)
  const gap = Math.round(scale * 6)

  const handleSave = async () => {
    if (simulationMode) {
      log(
        'info',
        `Screen settings saved (sim) — brightness ${String(brightness)}% contrast ${String(contrast)}%`
      )
      return
    }
    if (!connected) {
      log('warn', 'Screen settings: no device connected')
      return
    }
    const result = await usbService.pushScreenSettings({
      brightness,
      contrast,
      sleep: sleepTimeoutS,
      rotation,
    })
    if (result.success) {
      log(
        'success',
        `Screen settings pushed — brightness ${String(brightness)}% contrast ${String(contrast)}% rotation ${String(rotation)}°`
      )
    } else {
      log('error', `Screen settings push failed: ${result.error ?? 'unknown error'}`)
    }
  }

  const canSave = connected || simulationMode

  const handleOtaUsb = () => {
    if (!connected) {
      log('warn', 'Firmware update: no device connected')
      return
    }
    setOtaState('pending')
    // TODO: trigger firmware:update-usb IPC when OTA is implemented in main process
    log('info', 'Firmware USB update initiated — not yet implemented')
    setTimeout(() => {
      setOtaState('idle')
    }, 2000)
  }

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        background: '#0D0D0D',
        zIndex: 50,
        display: 'flex',
        flexDirection: 'column',
        padding: Math.round(scale * 8),
        boxSizing: 'border-box',
        gap,
        overflowY: 'auto',
      }}
      onMouseDown={(e) => {
        e.stopPropagation()
      }}
    >
      {/* Header */}
      <span
        style={{
          fontSize: fsLg,
          fontWeight: 700,
          color: '#CCCCCC',
          letterSpacing: '0.05em',
          marginBottom: Math.round(scale * 2),
        }}
      >
        SCREEN SETTINGS
      </span>

      {/* Brightness */}
      <SettingRow label="BRIGHTNESS" value={`${String(brightness)}%`} scale={scale}>
        <input
          type="range"
          min={10}
          max={100}
          value={brightness}
          onChange={(e) => {
            set({ brightness: Number(e.target.value) })
          }}
          style={{
            width: '100%',
            accentColor: '#CC3333',
            cursor: 'pointer',
            height: Math.round(scale * 3),
          }}
        />
      </SettingRow>

      {/* Contrast */}
      <SettingRow label="CONTRAST" value={`${String(contrast)}%`} scale={scale}>
        <input
          type="range"
          min={0}
          max={100}
          value={contrast}
          onChange={(e) => {
            set({ contrast: Number(e.target.value) })
          }}
          style={{
            width: '100%',
            accentColor: '#CC3333',
            cursor: 'pointer',
            height: Math.round(scale * 3),
          }}
        />
      </SettingRow>

      {/* Sleep */}
      <SettingRow
        label="SLEEP"
        value={sleepTimeoutS === 0 ? 'Off' : `${String(sleepTimeoutS)}s`}
        scale={scale}
      >
        <div style={{ display: 'flex', gap: Math.round(scale * 3) }}>
          {([0, 30, 60, 300] as const).map((v) => (
            <button
              key={v}
              onClick={() => {
                set({ sleepTimeoutS: v })
              }}
              style={{
                flex: 1,
                padding: `${String(Math.round(scale * 2))}px 0`,
                background: sleepTimeoutS === v ? '#1A0A0A' : '#111111',
                border: `1px solid ${sleepTimeoutS === v ? '#CC3333' : '#2A2A2A'}`,
                borderRadius: 3,
                color: sleepTimeoutS === v ? '#CC3333' : '#AAAAAA',
                fontSize: fs,
                cursor: 'pointer',
                lineHeight: 1,
              }}
            >
              {v === 0 ? 'Off' : v < 60 ? `${String(v)}s` : `${String(v / 60)}m`}
            </button>
          ))}
        </div>
      </SettingRow>

      {/* Rotation */}
      <SettingRow label="ROTATION" value={`${String(rotation)}°`} scale={scale}>
        <div style={{ display: 'flex', gap: Math.round(scale * 3) }}>
          {([0, 90, 180, 270] as const).map((r) => (
            <button
              key={r}
              onClick={() => {
                set({ rotation: r })
              }}
              style={{
                flex: 1,
                padding: `${String(Math.round(scale * 2))}px 0`,
                background: rotation === r ? '#1A0A0A' : '#111111',
                border: `1px solid ${rotation === r ? '#CC3333' : '#2A2A2A'}`,
                borderRadius: 3,
                color: rotation === r ? '#CC3333' : '#AAAAAA',
                fontSize: fs,
                cursor: 'pointer',
                lineHeight: 1,
              }}
            >
              {r}°
            </button>
          ))}
        </div>
      </SettingRow>

      {/* Firmware update */}
      <div style={{ borderTop: '1px solid #1E1E1E', paddingTop: gap }}>
        <span
          style={{
            fontSize: Math.round(scale * 5.5),
            color: '#AAAAAA',
            letterSpacing: '0.06em',
            display: 'block',
            marginBottom: Math.round(scale * 3),
          }}
        >
          FIRMWARE
        </span>
        <div style={{ display: 'flex', gap: Math.round(scale * 3) }}>
          <button
            onClick={handleOtaUsb}
            disabled={!connected || otaState === 'pending'}
            style={{
              flex: 1,
              padding: `${String(Math.round(scale * 2.5))}px 0`,
              background: connected ? '#111B11' : '#111111',
              border: `1px solid ${connected ? '#2A4A2A' : '#1E1E1E'}`,
              borderRadius: 3,
              color: connected ? '#55AA55' : '#333333',
              fontSize: fs,
              cursor: connected && otaState === 'idle' ? 'pointer' : 'default',
              lineHeight: 1,
            }}
          >
            {otaState === 'pending' ? '...' : 'USB'}
          </button>
          <button
            disabled
            title="Wi-Fi OTA — Phase 2"
            style={{
              flex: 1,
              padding: `${String(Math.round(scale * 2.5))}px 0`,
              background: '#111111',
              border: '1px solid #1A1A1A',
              borderRadius: 3,
              color: '#2A2A2A',
              fontSize: fs,
              cursor: 'default',
              lineHeight: 1,
            }}
          >
            Wi-Fi
          </button>
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: Math.round(scale * 3), marginTop: 'auto' }}>
        <button
          onClick={reset}
          style={{
            flex: 1,
            padding: `${String(Math.round(scale * 3))}px 0`,
            background: 'transparent',
            border: '1px solid #2A2A2A',
            borderRadius: 4,
            color: '#AAAAAA',
            fontSize: fs,
            cursor: 'pointer',
          }}
        >
          RESET
        </button>
        <button
          onClick={handleSave}
          disabled={!canSave}
          style={{
            flex: 2,
            padding: `${String(Math.round(scale * 3))}px 0`,
            background: canSave ? '#1A3A1A' : '#111111',
            border: `1px solid ${canSave ? '#336633' : '#2A2A2A'}`,
            borderRadius: 4,
            color: canSave ? '#55AA55' : '#333333',
            fontSize: fs,
            fontWeight: 600,
            cursor: canSave ? 'pointer' : 'default',
          }}
        >
          SAVE
        </button>
      </div>
    </div>
  )
}

function SettingRow({
  label,
  value,
  scale,
  children,
}: {
  label: string
  value: string
  scale: number
  children: React.ReactNode
}) {
  const fs = Math.round(scale * 5.5)

  return (
    <div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginBottom: Math.round(scale * 2.5),
        }}
      >
        <span style={{ fontSize: fs, color: '#AAAAAA', letterSpacing: '0.06em' }}>{label}</span>
        <span style={{ fontSize: fs, color: '#888888' }}>{value}</span>
      </div>
      {children}
    </div>
  )
}
