import { useRef, type PointerEvent } from 'react'
import type { TopBarConfig, TopBarItem } from '@tmbk/canshift-core'
import { DEFAULT_TOP_BAR_LAYOUT, TopBarMetrics } from '@tmbk/canshift-core'

const SWIPE_DOWN_THRESHOLD = 18

const PREVIEW_SIGNAL_VALUES: Record<string, number> = {
  battery_volts: 12.4,
  rpm: 3500,
  speed_kph: 80,
  coolant_temp_c: 88,
  oil_press_bar: 4.2,
  oil_temp_c: 95,
}

const formatPreviewSignal = (signal: string, format?: string): string => {
  const value = PREVIEW_SIGNAL_VALUES[signal]
  if (value === undefined) return '--'
  if (!format) return value.toFixed(1)
  const m = /%\.(\d+)f(.*)/.exec(format)
  if (!m) return format.replace('%f', value.toFixed(1))
  const decimals = parseInt(m[1] ?? '1', 10)
  const suffix = m[2] ?? ''
  return value.toFixed(decimals) + suffix
}

export interface DashTopBarProps {
  topBar: TopBarConfig
  scale: number
  settingsOpen: boolean
  isDayMode: boolean
  onOpenSettings: () => void
}

export const DashTopBar = ({
  topBar,
  scale,
  settingsOpen,
  isDayMode,
  onOpenSettings,
}: DashTopBarProps) => {
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
        return null
      case 'themeToggle':
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
