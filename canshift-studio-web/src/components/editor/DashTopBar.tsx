// DashTopBar.tsx — Studio preview of the firmware top status bar.
// Mirrors the firmware layout 1:1 (canshift-firmware/src/ui/top_bar.cpp) so
// edits made in the editor look identical on device. Items come from the
// dashboard's `topBar.layout` array; proportions come from
// `canshift-core/src/topbar-metrics.ts` (the same table the firmware mirrors).

import { useRef, type PointerEvent } from 'react'
import type { TopBarConfig, TopBarItem } from '@tmbk/canshift-core'
import { DEFAULT_TOP_BAR_LAYOUT, TopBarMetrics } from '@tmbk/canshift-core'

// Swipe-down threshold in px (in SCALE coordinates) to trigger settings open.
const SWIPE_DOWN_THRESHOLD = 18

// Representative preview values for `signal` items in the top bar — the studio
// has no live ECU data, so we show a static plausible reading. The signal name
// drives which placeholder is used; unknown signals fall back to "--".
const PREVIEW_SIGNAL_VALUES: Record<string, number> = {
  battery_volts: 12.4,
  rpm: 3500,
  speed_kph: 80,
  coolant_temp_c: 88,
  oil_press_bar: 4.2,
  oil_temp_c: 95,
}

function formatPreviewSignal(signal: string, format?: string): string {
  const value = PREVIEW_SIGNAL_VALUES[signal]
  if (value === undefined) return '--'
  if (!format) return value.toFixed(1)
  // Minimal printf %.<N>f handler — the only format we expose in the schema.
  const m = /%\.(\d+)f(.*)/.exec(format)
  if (!m) return format.replace('%f', value.toFixed(1))
  const decimals = parseInt(m[1] ?? '1', 10)
  const suffix = m[2] ?? ''
  return value.toFixed(decimals) + suffix
}

export interface DashTopBarProps {
  topBar: TopBarConfig
  /** Display scale factor — multiplies `topBar.height` to the canvas-pixel height. */
  scale: number
  settingsOpen: boolean
  isDayMode: boolean
  onOpenSettings: () => void
}

export function DashTopBar({
  topBar,
  scale,
  settingsOpen,
  isDayMode,
  onOpenSettings,
}: DashTopBarProps) {
  const swipeStartY = useRef<number | null>(null)

  const h = topBar.height * scale
  const dot = Math.round(h * TopBarMetrics.dotRatio)
  const fs = Math.round(h * TopBarMetrics.fontSizeRatio)
  const sep = Math.round(h * TopBarMetrics.separatorRatio)
  const gap = Math.round(h * TopBarMetrics.gapRatio)
  const px = Math.round(h * TopBarMetrics.paddingRatio)

  const handlePointerDown = (e: PointerEvent) => {
    swipeStartY.current = e.clientY
  }

  const handlePointerUp = (e: PointerEvent) => {
    if (swipeStartY.current === null) return
    const dy = e.clientY - swipeStartY.current
    swipeStartY.current = null
    if (dy > SWIPE_DOWN_THRESHOLD) onOpenSettings()
    else if (dy < -SWIPE_DOWN_THRESHOLD && settingsOpen) onOpenSettings()
  }

  const layout: readonly TopBarItem[] = topBar.layout ?? DEFAULT_TOP_BAR_LAYOUT
  const leftItems = layout.filter((it) => it.position === 'left')
  const centerItems = layout.filter((it) => it.position === 'center')
  const rightItems = layout.filter((it) => it.position === 'right')

  const renderItem = (item: TopBarItem, key: number) => {
    switch (item.type) {
      case 'statusDot':
        return (
          <span
            key={key}
            style={{
              display: 'inline-block',
              width: dot,
              height: dot,
              borderRadius: '50%',
              background: '#44CC44',
              boxShadow: '0 0 3px #44CC4488',
              flexShrink: 0,
            }}
          />
        )
      case 'label':
        return (
          <span
            key={key}
            style={{
              fontSize: fs,
              color: topBar.textColor,
              letterSpacing: '0.04em',
              lineHeight: 1,
            }}
          >
            {item.text}
          </span>
        )
      case 'separator':
        return (
          <span key={key} style={{ width: 1, height: sep, background: '#2A2A2A', flexShrink: 0 }} />
        )
      case 'signal':
        // Studio preview can't read live device values — show a representative
        // sample formatted with the configured pattern. Falls back to a generic
        // placeholder if the format is omitted.
        return (
          <span key={key} style={{ fontSize: fs, color: '#777777', lineHeight: 1 }}>
            {formatPreviewSignal(item.signal, item.format)}
          </span>
        )
      case 'bleIcon':
        return (
          <span
            key={key}
            style={{ fontSize: fs, color: '#4499FF', lineHeight: 1, letterSpacing: '0.04em' }}
          >
            BLE
          </span>
        )
      case 'usbIcon':
        // Hidden in Studio preview — firmware mirrors this in top_bar.cpp by
        // returning early on USB_ICON. Kept in the schema discriminator union
        // so existing user configs that still reference it parse cleanly; we
        // just don't render anything.
        return null
      case 'themeToggle':
        // Firmware top_bar.cpp shows the CURRENT mode (icon_day.bin in day,
        // icon_night.bin in night) — see `THEME_TOGGLE` branch + `reapplyTheme`.
        // Mirror that here: sun glyph in day mode, moon glyph in night mode.
        // The tooltip still describes the action (the OTHER mode you'd switch to)
        // so users don't lose the affordance hint. Issue #957.
        return (
          <span
            key={key}
            style={{
              fontSize: fs + 1,
              lineHeight: 1,
              color: topBar.textColor,
              flexShrink: 0,
            }}
          >
            {isDayMode ? '☀' : '☾'}
          </span>
        )
      case 'modeFlag':
        return (
          <span key={key} style={{ fontSize: fs, color: '#FF8800', lineHeight: 1, opacity: 0.4 }}>
            {item.text}
          </span>
        )
      case 'trackBadge':
        // Studio preview can't read live BLE state — render a muted amber
        // TRACK label so the layout slot is visible. The firmware lights it
        // up only when canshift-mobile pushes trackMode=true. Issue #844.
        return (
          <span key={key} style={{ fontSize: fs, color: '#FF8800', lineHeight: 1, opacity: 0.4 }}>
            TRACK
          </span>
        )
    }
  }

  return (
    <div
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      style={{
        height: h,
        flexShrink: 0,
        background: settingsOpen ? topBar.bgColor + 'CC' : topBar.bgColor,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: `0 ${String(px)}px`,
        boxSizing: 'border-box',
        borderBottom: `1px solid ${settingsOpen ? '#CC333333' : '#1E1E1E'}`,
        userSelect: 'none',
        position: 'relative',
        overflow: 'hidden',
        cursor: 'default',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap }}>
        {leftItems.map((it, i) => renderItem(it, i))}
      </div>

      {centerItems.length > 0 && (
        <div
          style={{
            position: 'absolute',
            left: '50%',
            transform: 'translateX(-50%)',
            display: 'flex',
            alignItems: 'center',
            gap,
          }}
        >
          {centerItems.map((it, i) => renderItem(it, i))}
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap }}>
        {rightItems.map((it, i) => renderItem(it, i))}
      </div>

      {/* Swipe-down hint — subtle chevron */}
      <div
        style={{
          position: 'absolute',
          bottom: 1,
          left: '50%',
          transform: 'translateX(-50%)',
          fontSize: fs * 0.7,
          color: '#FFFFFF22',
          lineHeight: 1,
          pointerEvents: 'none',
        }}
      >
        ▾
      </div>
    </div>
  )
}
