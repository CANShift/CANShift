import { useState } from 'react'
import type { CSSProperties } from 'react'
import { useDeviceStore } from '../stores/device.store'
import { useLogStore } from '../stores/log.store'
import { usbService } from '../transport'
import { ThemeStatusCard } from '../components/themes/ThemeStatusCard'
import { ThemeControls } from '../components/themes/ThemeControls'
import { RouteHeader } from '../components/shell/RouteHeader'

const ThemesRoute = () => {
  const connected = useDeviceStore((s) => s.connected)
  const simulationMode = useDeviceStore((s) => s.simulationMode)
  const isDayMode = useDeviceStore((s) => s.isDayMode)
  const setIsDayMode = useDeviceStore((s) => s.setIsDayMode)
  const log = useLogStore((s) => s.push)
  const [busy, setBusy] = useState(false)

  const canControl = connected && !simulationMode
  const disabled = !canControl

  const onToggle = async () => {
    setBusy(true)
    const result = await usbService.toggleDayNight()
    if (result.success) {
      const next = isDayMode === true ? false : isDayMode === false ? true : null
      setIsDayMode(next)
      log(
        'success',
        `Theme toggled to ${next === true ? 'Day' : next === false ? 'Night' : 'unknown'}`
      )
    } else {
      log('error', `Theme toggle failed: ${result.error ?? 'unknown_error'}`)
    }
    setBusy(false)
  }

  const onSetDay = async () => {
    setBusy(true)
    const result = await usbService.setDayNight(true)
    if (result.success) {
      setIsDayMode(true)
      log('success', 'Theme forced to Day')
    } else {
      log('error', `Set Day failed: ${result.error ?? 'unknown_error'}`)
    }
    setBusy(false)
  }

  const onSetNight = async () => {
    setBusy(true)
    const result = await usbService.setDayNight(false)
    if (result.success) {
      setIsDayMode(false)
      log('success', 'Theme forced to Night')
    } else {
      log('error', `Set Night failed: ${result.error ?? 'unknown_error'}`)
    }
    setBusy(false)
  }

  return (
    <div style={pageStyle}>
      <RouteHeader
        title="Themes"
        subtitle="Day / night palette state read from the device on connect. The active dashboard config decides per-page colours; this route flips the global mode the firmware uses to pick which palette to render."
      />
      <div style={containerStyle}>
        <div style={contentStyle}>
          <ThemeStatusCard
            isDayMode={isDayMode}
            connected={connected}
            simulationMode={simulationMode}
          />

          <ThemeControls
            isDayMode={isDayMode}
            disabled={disabled}
            busy={busy}
            onToggle={() => {
              void onToggle()
            }}
            onSetDay={() => {
              void onSetDay()
            }}
            onSetNight={() => {
              void onSetNight()
            }}
          />

          {disabled && (
            <div style={hintStyle}>
              Theme commands are sent over USB. Connect a device to enable them.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

const pageStyle: CSSProperties = {
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  background: 'hsl(var(--bg))',
  overflow: 'hidden',
}

const containerStyle: CSSProperties = {
  flex: 1,
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'center',
  padding: '24px 28px',
  overflowY: 'auto',
}

const contentStyle: CSSProperties = {
  width: '100%',
  maxWidth: 560,
  display: 'flex',
  flexDirection: 'column',
  gap: 24,
}

const hintStyle: CSSProperties = {
  fontSize: 12,
  color: 'hsl(var(--text-muted))',
  padding: '10px 14px',
  background: 'hsl(var(--bg-inset))',
  border: '1px solid hsl(var(--border))',
}

export default ThemesRoute
