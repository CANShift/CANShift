import { useState } from 'react'
import type { CSSProperties } from 'react'
import { THEME_PRESETS, themePresetById } from '@tmbk/canshift-core'
import type { ThemePreset, ThemePresetEntry } from '@tmbk/canshift-core'
import { useDashboardStore } from '../stores/dashboard.store'
import { useDeviceStore } from '../stores/device.store'
import { useLogStore } from '../stores/log.store'
import { usbService } from '../transport'
import { ThemeCard, hexLuminance, type ThemeSlotBadge } from '../components/themes/ThemeCard'
import { ThemeTokensRail } from '../components/themes/ThemeTokensRail'
import { ThemeStatusCard } from '../components/themes/ThemeStatusCard'
import { ThemeControls } from '../components/themes/ThemeControls'
import { MONO_FONT } from '../lib/typography'

const LIGHT_BG_LUMINANCE = 0.5

const samePreset = (a: ThemePreset | undefined, b: ThemePreset): boolean =>
  a !== undefined && JSON.stringify(a) === JSON.stringify(b)

const slotFor = (entry: ThemePresetEntry): 'night' | 'day' =>
  hexLuminance(entry.preset.bgColor) > LIGHT_BG_LUMINANCE ? 'day' : 'night'

const ThemesRoute = () => {
  const config = useDashboardStore((s) => s.config)
  const setDayTheme = useDashboardStore((s) => s.setDayTheme)
  const setNightTheme = useDashboardStore((s) => s.setNightTheme)
  const connected = useDeviceStore((s) => s.connected)
  const simulationMode = useDeviceStore((s) => s.simulationMode)
  const isDayMode = useDeviceStore((s) => s.isDayMode)
  const setIsDayMode = useDeviceStore((s) => s.setIsDayMode)
  const log = useLogStore((s) => s.push)
  const [busy, setBusy] = useState(false)

  const canControl = connected && !simulationMode

  const nightFallback = themePresetById('night')
  const activeNight = config?.nightTheme ?? nightFallback?.preset ?? null

  const badgeFor = (entry: ThemePresetEntry): ThemeSlotBadge => {
    if (config && samePreset(config.nightTheme, entry.preset)) return 'night'
    if (!config?.nightTheme && entry.id === 'night') return 'night'
    if (config && samePreset(config.dayTheme, entry.preset)) return 'day'
    return null
  }

  const applyPreset = (entry: ThemePresetEntry) => {
    const slot = slotFor(entry)
    if (slot === 'day') {
      setDayTheme(entry.preset)
      log('success', `Day theme set to "${entry.label}" — burn to apply on the device`)
    } else {
      setNightTheme(entry.preset)
      log('success', `Night theme set to "${entry.label}" — burn to apply on the device`)
    }
  }

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
      <header style={toolbarStyle}>
        <span style={titleStyle}>Themes</span>
        <span style={summaryStyle}>applies to every page on the device</span>
      </header>
      <div style={bodyStyle}>
        <div style={gridWrapStyle}>
          <div style={gridStyle}>
            {THEME_PRESETS.map((entry) => (
              <ThemeCard
                key={entry.id}
                entry={entry}
                badge={badgeFor(entry)}
                targetSlot={slotFor(entry)}
                onSelect={() => {
                  applyPreset(entry)
                }}
              />
            ))}
          </div>
        </div>
        {activeNight && (
          <ThemeTokensRail title="NIGHT — TOKENS" preset={activeNight}>
            <ThemeStatusCard
              isDayMode={isDayMode}
              connected={connected}
              simulationMode={simulationMode}
            />
            <ThemeControls
              isDayMode={isDayMode}
              disabled={!canControl}
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
            {!canControl && (
              <div style={hintStyle}>
                Theme commands are sent over USB. Connect a device to enable them.
              </div>
            )}
          </ThemeTokensRail>
        )}
      </div>
    </div>
  )
}

const pageStyle: CSSProperties = {
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  background: 'hsl(var(--brand-chrome-bg))',
  overflow: 'hidden',
}

const toolbarStyle: CSSProperties = {
  height: 48,
  flexShrink: 0,
  display: 'flex',
  alignItems: 'center',
  gap: 14,
  padding: '0 20px',
  borderBottom: '2px solid var(--brand-divider)',
}

const titleStyle: CSSProperties = {
  fontWeight: 800,
  fontSize: 14,
  color: 'hsl(var(--brand-text))',
}

const summaryStyle: CSSProperties = {
  fontFamily: MONO_FONT,
  fontSize: 11,
  color: 'hsl(var(--brand-neutral-600))',
}

const bodyStyle: CSSProperties = {
  flex: 1,
  display: 'flex',
  minHeight: 0,
}

const gridWrapStyle: CSSProperties = {
  flex: 1,
  minWidth: 0,
  overflowY: 'auto',
  padding: 24,
}

const gridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: 20,
  alignContent: 'start',
}

const hintStyle: CSSProperties = {
  fontSize: 12,
  color: 'hsl(var(--brand-neutral-500))',
  padding: '10px 14px',
  border: '1px solid hsl(var(--brand-neutral-300))',
}

export default ThemesRoute
