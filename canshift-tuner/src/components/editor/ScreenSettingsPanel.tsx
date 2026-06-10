import { useState } from 'react'
import { useScreenSettingsStore } from '../../stores/screen-settings.store'
import { useLogStore } from '../../stores/log.store'
import { useDeviceState } from '../../hooks/useDeviceState'
import { usePreviewTheme } from '../../hooks/useDashboardConfig'
import { usbService } from '../../transport'
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

const SCREEN_BG = '#0D0D0D'
const SCREEN_LABEL = '#AAAAAA'
const SCREEN_VALUE = '#888888'
const SCREEN_HEADER = '#CCCCCC'
const BTN_BG = '#111111'
const BTN_BORDER = '#2A2A2A'
const BTN_BORDER_DIM = '#1E1E1E'
const BTN_FG_DISABLED = '#444444'
const ACCENT_RED = '#CC3333'
const ACCENT_RED_BG = '#1A0A0A'

interface ScreenSettingsPanelProps {
  scale: number
}

export default function ScreenSettingsPanel({ scale }: ScreenSettingsPanelProps) {
  const brightness = useScreenSettingsStore((s) => s.brightness)
  const rotation = useScreenSettingsStore((s) => s.rotation)
  const updateScreenSettings = useScreenSettingsStore((s) => s.update)
  const { connected, simulationMode, isDayMode, setIsDayMode } = useDeviceState()
  const { isPreviewDayMode, togglePreviewTheme } = usePreviewTheme()
  const log = useLogStore((s) => s.push)
  const [calibrating, setCalibrating] = useState(false)
  const [pendingRotation180, setPendingRotation180] = useState(false)
  const [pendingCalibration, setPendingCalibration] = useState(false)

  const fs = Math.round(scale * 6)
  const fsLg = Math.round(scale * 7)
  const gap = Math.round(scale * 6)

  const pushScreenSettings = async (nextRotation = rotation) => {
    if (simulationMode || !connected) return
    const result = await usbService.pushScreenSettings({
      brightness,
      sleep: 0,
      rotation: nextRotation,
    })
    if (result.success) {
      log('success', `Screen settings pushed — brightness ${String(brightness)}%`)
    } else {
      log('error', `Screen settings push failed: ${result.error ?? 'unknown error'}`)
    }
  }

  const handleBrightnessCommit = () => {
    void pushScreenSettings()
  }

  const handleRotationSelect = (deg: 0 | 180) => {
    if (rotation === deg) return
    updateScreenSettings({ rotation: deg })
    if (deg === 180) {
      setPendingRotation180(true)
      return
    }
    void pushScreenSettings(deg)
  }

  const handleConfirmRotation180 = () => {
    setPendingRotation180(false)
    void pushScreenSettings(180)
  }

  const canDeviceAction = connected && !simulationMode

  const activeDayMode = isDayMode ?? isPreviewDayMode

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

  return (
    <>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: SCREEN_BG,
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
        <span
          style={{
            fontSize: fsLg,
            fontWeight: 700,
            color: SCREEN_HEADER,
            letterSpacing: '0.05em',
            marginBottom: Math.round(scale * 2),
          }}
        >
          SCREEN SETTINGS
        </span>

        <SettingRow label="BRIGHTNESS" value={`${String(brightness)}%`} scale={scale}>
          <input
            type="range"
            min={10}
            max={100}
            value={brightness}
            onChange={(e) => {
              updateScreenSettings({ brightness: Number(e.target.value) })
            }}
            onMouseUp={handleBrightnessCommit}
            onTouchEnd={handleBrightnessCommit}
            onKeyUp={handleBrightnessCommit}
            style={{
              width: '100%',
              accentColor: ACCENT_RED,
              cursor: 'pointer',
              height: Math.round(scale * 3),
            }}
          />
        </SettingRow>

        <SettingRow label="THEME" value={activeDayMode ? 'Day' : 'Night'} scale={scale}>
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
                    background: active ? ACCENT_RED_BG : BTN_BG,
                    border: `1px solid ${active ? ACCENT_RED : BTN_BORDER}`,
                    borderRadius: 3,
                    color: active ? ACCENT_RED : SCREEN_LABEL,
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

        <SettingRow label="MOUNTING" value={rotation === 180 ? '180°' : '0°'} scale={scale}>
          <div style={{ display: 'flex', gap: Math.round(scale * 3) }}>
            {([0, 180] as const).map((deg) => {
              const active = rotation === deg
              return (
                <button
                  key={deg}
                  onClick={() => {
                    handleRotationSelect(deg)
                  }}
                  style={{
                    flex: 1,
                    padding: `${String(Math.round(scale * 2))}px 0`,
                    background: active ? ACCENT_RED_BG : BTN_BG,
                    border: `1px solid ${active ? ACCENT_RED : BTN_BORDER}`,
                    borderRadius: 3,
                    color: active ? ACCENT_RED : SCREEN_LABEL,
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

        <SettingRow label="TOUCH" value="" scale={scale}>
          <button
            onClick={handleCalibrate}
            disabled={!canDeviceAction || calibrating}
            style={{
              width: '100%',
              padding: `${String(Math.round(scale * 2))}px 0`,
              background: BTN_BG,
              border: `1px solid ${canDeviceAction ? BTN_BORDER : BTN_BORDER_DIM}`,
              borderRadius: 3,
              color: canDeviceAction ? SCREEN_LABEL : BTN_FG_DISABLED,
              fontSize: fs,
              cursor: canDeviceAction && !calibrating ? 'pointer' : 'default',
              lineHeight: 1,
            }}
          >
            {calibrating ? '...' : 'CALIBRATE'}
          </button>
        </SettingRow>
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

const SettingRow = ({
  label,
  value,
  scale,
  children,
}: {
  label: string
  value: string
  scale: number
  children: React.ReactNode
}) => {
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
        <span style={{ fontSize: fs, color: SCREEN_LABEL, letterSpacing: '0.06em' }}>{label}</span>
        <span style={{ fontSize: fs, color: SCREEN_VALUE }}>{value}</span>
      </div>
      {children}
    </div>
  )
}
