// ScreenSettingsPanel.tsx — Full-canvas overlay page for physical screen settings.
// Rendered inside the 320×240 canvas widget area, simulating an on-device settings page.
// Closed exclusively via swipe-down gesture in the top bar.

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useScreenSettingsStore } from '../../stores/screenSettings.store'
import { useDeviceStore } from '../../stores/device.store'
import { useLogStore } from '../../stores/log.store'
import { useDashboardStore } from '../../stores/dashboard.store'
import { usbService } from '../../services/ipc.service'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

interface ScreenSettingsPanelProps {
  scale: number
}

export default function ScreenSettingsPanel({ scale }: ScreenSettingsPanelProps) {
  const navigate = useNavigate()
  const brightness = useScreenSettingsStore((s) => s.brightness)
  const rotation = useScreenSettingsStore((s) => s.rotation)
  const set = useScreenSettingsStore((s) => s.set)
  const reset = useScreenSettingsStore((s) => s.reset)
  const connected = useDeviceStore((s) => s.connected)
  const simulationMode = useDeviceStore((s) => s.simulationMode)
  const isDayMode = useDeviceStore((s) => s.isDayMode)
  const setIsDayMode = useDeviceStore((s) => s.setIsDayMode)
  const isPreviewDayMode = useDashboardStore((s) => s.isPreviewDayMode)
  const togglePreviewTheme = useDashboardStore((s) => s.togglePreviewTheme)
  const log = useLogStore((s) => s.push)
  const [otaState, setOtaState] = useState<'idle' | 'pending'>('idle')
  const [calibrating, setCalibrating] = useState(false)
  const [pendingRotation180, setPendingRotation180] = useState(false)
  const [pendingCalibration, setPendingCalibration] = useState(false)

  const fs = Math.round(scale * 6)
  const fsLg = Math.round(scale * 7)
  const gap = Math.round(scale * 6)

  const pushScreenSettings = async () => {
    const result = await usbService.pushScreenSettings({
      brightness,
      sleep: 0,
      rotation,
    })
    if (result.success) {
      log('success', `Screen settings pushed — brightness ${String(brightness)}%`)
    } else {
      log('error', `Screen settings push failed: ${result.error ?? 'unknown error'}`)
    }
  }

  const handleSave = async () => {
    if (simulationMode) {
      log('info', `Screen settings saved (sim) — brightness ${String(brightness)}%`)
      return
    }
    if (!connected) {
      log('warn', 'Screen settings: no device connected')
      return
    }
    // Rotation is always sent. Firmware only reboots when the new value
    // differs from the persisted one, so studio doesn't need to know the
    // device's current orientation — a no-op rotation is free.
    if (rotation === 180) {
      setPendingRotation180(true)
      return
    }
    await pushScreenSettings()
  }

  const handleConfirmRotation180 = () => {
    setPendingRotation180(false)
    void pushScreenSettings()
  }

  const canSave = connected || simulationMode
  const canDeviceAction = connected && !simulationMode

  // Active day mode: device value when connected, local preview otherwise.
  const activeDayMode = isDayMode ?? isPreviewDayMode

  // Day/Night selection — fires immediately for both connected and preview modes.
  const handleSelectMode = async (target: 'night' | 'day') => {
    const day = target === 'day'
    if (!canDeviceAction) {
      if (isPreviewDayMode !== day) togglePreviewTheme()
      return
    }
    if (isDayMode === day) return
    const result = await usbService.setDayNight(day)
    if (result.success) {
      setIsDayMode(day)
      log('success', `Theme set to ${target}`)
    } else {
      log('error', `Theme set failed: ${result.error ?? 'unknown error'}`)
    }
  }

  const handleCalibrate = () => {
    if (!canDeviceAction) return
    setPendingCalibration(true)
  }

  const handleConfirmCalibration = async () => {
    setPendingCalibration(false)
    setCalibrating(true)
    const result = await usbService.calibrateTouch()
    setCalibrating(false)
    if (result.success) {
      log('info', 'Touch calibration started — follow the crosshairs on the device')
    } else {
      log('error', `Calibration failed: ${result.error ?? 'unknown error'}`)
    }
  }

  const handleOtaUsb = () => {
    if (!connected) {
      log('warn', 'Firmware update: no device connected')
      return
    }
    setOtaState('pending')
    // Navigate to the Firmware Update tab — the full flash UI lives there
    setTimeout(() => {
      setOtaState('idle')
      navigate('/update')
    }, 200)
  }

  return (
    <>
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

        {/* Theme — fires immediately for both connected and preview modes */}
        <SettingRow
          label="THEME"
          value={activeDayMode ? 'Day' : 'Night'}
          scale={scale}
        >
          <div style={{ display: 'flex', gap: Math.round(scale * 3) }}>
            {(['night', 'day'] as const).map((mode) => {
              const active = activeDayMode === (mode === 'day')
              return (
                <button
                  key={mode}
                  onClick={() => {
                    void handleSelectMode(mode)
                  }}
                  style={{
                    flex: 1,
                    padding: `${String(Math.round(scale * 2))}px 0`,
                    background: active ? '#1A0A0A' : '#111111',
                    border: `1px solid ${active ? '#CC3333' : '#2A2A2A'}`,
                    borderRadius: 3,
                    color: active ? '#CC3333' : '#AAAAAA',
                    fontSize: fs,
                    cursor: 'pointer',
                    lineHeight: 1,
                    textTransform: 'capitalize',
                  }}
                >
                  {mode}
                </button>
              )
            })}
          </div>
        </SettingRow>

        {/* Mounting orientation — applied on save, reboots the device */}
        <SettingRow label="MOUNTING" value={rotation === 180 ? '180°' : '0°'} scale={scale}>
          <div style={{ display: 'flex', gap: Math.round(scale * 3) }}>
            {([0, 180] as const).map((deg) => {
              const active = rotation === deg
              return (
                <button
                  key={deg}
                  onClick={() => {
                    set({ rotation: deg })
                  }}
                  style={{
                    flex: 1,
                    padding: `${String(Math.round(scale * 2))}px 0`,
                    background: active ? '#1A0A0A' : '#111111',
                    border: `1px solid ${active ? '#CC3333' : '#2A2A2A'}`,
                    borderRadius: 3,
                    color: active ? '#CC3333' : '#AAAAAA',
                    fontSize: fs,
                    cursor: 'pointer',
                    lineHeight: 1,
                  }}
                >
                  {deg === 0 ? '0°' : '180°'}
                </button>
              )
            })}
          </div>
        </SettingRow>

        {/* Touch calibration + reset — same row, same style as theme buttons */}
        <SettingRow label="TOUCH" value="" scale={scale}>
          <div style={{ display: 'flex', gap: Math.round(scale * 3) }}>
            <button
              onClick={handleCalibrate}
              disabled={!canDeviceAction || calibrating}
              style={{
                flex: 1,
                padding: `${String(Math.round(scale * 2))}px 0`,
                background: '#111111',
                border: `1px solid ${canDeviceAction ? '#2A2A2A' : '#1E1E1E'}`,
                borderRadius: 3,
                color: canDeviceAction ? '#AAAAAA' : '#444444',
                fontSize: fs,
                cursor: canDeviceAction && !calibrating ? 'pointer' : 'default',
                lineHeight: 1,
              }}
            >
              {calibrating ? '...' : 'CALIBRATE'}
            </button>
            <button
              onClick={reset}
              style={{
                flex: 1,
                padding: `${String(Math.round(scale * 2))}px 0`,
                background: '#111111',
                border: '1px solid #2A2A2A',
                borderRadius: 3,
                color: '#AAAAAA',
                fontSize: fs,
                cursor: 'pointer',
                lineHeight: 1,
              }}
            >
              RESET
            </button>
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
          <button
            onClick={handleOtaUsb}
            disabled={!connected || otaState === 'pending'}
            style={{
              width: '100%',
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
        </div>

        {/* Actions */}
        <div style={{ marginTop: 'auto' }}>
          <button
            onClick={handleSave}
            disabled={!canSave}
            style={{
              width: '100%',
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
      <AlertDialog open={pendingRotation180} onOpenChange={setPendingRotation180}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Switching mounting orientation reboots the device</AlertDialogTitle>
            <AlertDialogDescription>
              Switching mounting orientation to 180° reboots the device and clears the touch
              calibration. You will be asked to re-calibrate on the next boot.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep current</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmRotation180}>
              Reboot and continue
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog open={pendingCalibration} onOpenChange={setPendingCalibration}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Start touch calibration on the device</AlertDialogTitle>
            <AlertDialogDescription>
              Calibration starts on the device. Tap each crosshair on the dashboard screen.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                void handleConfirmCalibration()
              }}
            >
              Continue
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
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
