// ScreenSettingsPanel.tsx — Full-canvas overlay page for physical screen settings.
// Rendered inside the 320×240 canvas widget area, simulating an on-device settings page.

import { useScreenSettingsStore } from '../../stores/screenSettings.store'

interface ScreenSettingsPanelProps {
  scale: number
  onClose: () => void
}

export default function ScreenSettingsPanel({ scale, onClose }: ScreenSettingsPanelProps) {
  const { brightness, contrast, sleepTimeoutS, rotation, set, reset } = useScreenSettingsStore()

  const fs   = Math.round(scale * 6)
  const fsLg = Math.round(scale * 7)
  const gap  = Math.round(scale * 6)

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
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: Math.round(scale * 2),
        }}
      >
        <span
          style={{
            fontSize: fsLg,
            fontWeight: 700,
            color: '#CCCCCC',
            letterSpacing: '0.05em',
          }}
        >
          SCREEN SETTINGS
        </span>
        <button
          onClick={onClose}
          style={{
            background: 'none',
            border: '1px solid #333333',
            borderRadius: 3,
            color: '#666666',
            cursor: 'pointer',
            fontSize: fs,
            padding: `${String(Math.round(scale * 1.5))}px ${String(Math.round(scale * 4))}px`,
            lineHeight: 1,
          }}
        >
          ✕
        </button>
      </div>

      {/* Brightness */}
      <SettingRow label="BRIGHTNESS" value={`${String(brightness)}%`} scale={scale}>
        <input
          type="range"
          min={10}
          max={100}
          value={brightness}
          onChange={(e) => { set({ brightness: Number(e.target.value) }) }}
          style={{ width: '100%', accentColor: '#CC3333', cursor: 'pointer', height: Math.round(scale * 3) }}
        />
      </SettingRow>

      {/* Contrast */}
      <SettingRow label="CONTRAST" value={`${String(contrast)}%`} scale={scale}>
        <input
          type="range"
          min={0}
          max={100}
          value={contrast}
          onChange={(e) => { set({ contrast: Number(e.target.value) }) }}
          style={{ width: '100%', accentColor: '#CC3333', cursor: 'pointer', height: Math.round(scale * 3) }}
        />
      </SettingRow>

      {/* Sleep */}
      <SettingRow label="SLEEP" value={sleepTimeoutS === 0 ? 'Off' : `${String(sleepTimeoutS)}s`} scale={scale}>
        <div style={{ display: 'flex', gap: Math.round(scale * 3) }}>
          {([0, 30, 60, 300] as const).map((v) => (
            <button
              key={v}
              onClick={() => { set({ sleepTimeoutS: v }) }}
              style={{
                flex: 1,
                padding: `${String(Math.round(scale * 2))}px 0`,
                background: sleepTimeoutS === v ? '#1A0A0A' : '#111111',
                border: `1px solid ${sleepTimeoutS === v ? '#CC3333' : '#2A2A2A'}`,
                borderRadius: 3,
                color: sleepTimeoutS === v ? '#CC3333' : '#555555',
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
              onClick={() => { set({ rotation: r }) }}
              style={{
                flex: 1,
                padding: `${String(Math.round(scale * 2))}px 0`,
                background: rotation === r ? '#1A0A0A' : '#111111',
                border: `1px solid ${rotation === r ? '#CC3333' : '#2A2A2A'}`,
                borderRadius: 3,
                color: rotation === r ? '#CC3333' : '#555555',
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

      {/* Reset */}
      <button
        onClick={reset}
        style={{
          marginTop: 'auto',
          padding: `${String(Math.round(scale * 3))}px 0`,
          background: 'transparent',
          border: '1px solid #2A2A2A',
          borderRadius: 4,
          color: '#444444',
          fontSize: fs,
          cursor: 'pointer',
        }}
      >
        RESET DEFAULTS
      </button>
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
        <span style={{ fontSize: fs, color: '#555555', letterSpacing: '0.06em' }}>{label}</span>
        <span style={{ fontSize: fs, color: '#888888' }}>{value}</span>
      </div>
      {children}
    </div>
  )
}
