// widget-previews/Timer.tsx — Lap/session timer preview.
// Mirrors firmware timer_widget.cpp: tabular Orbitron digits centred in the
// widget with an auto "TIMER" header pinned top-left. Static demo value
// matches the format ('mm:ss' default, or 'ss.mmm' when configured).
// Custom labels were dropped (issue #1244).

import { memo } from 'react'
import { FONT_FAMILY } from '../widgetPreview.styles'
import type { BaseRendererProps } from './shared'

// Demo values — chosen so each format reads as a plausible lap time.
const DEMO_MMSS = '01:23'
const DEMO_SS_MMM = '12.847'

export const TimerPreview = memo(function TimerPreview({ widget, w, h }: BaseRendererProps) {
  if (widget.config.type !== 'timer') return null
  const cfg = widget.config
  const st = widget.style
  const timeStr = cfg.format === 'ss.mmm' ? DEMO_SS_MMM : DEMO_MMSS
  // Same font-tier break (≥80 px → secondary 24, ≥110 px → primary 32) as
  // firmware timer_widget.cpp. Below 80 px we render at secondary 20.
  const fontSize = Math.max(9, Math.min(h * 0.44, w * 0.22))
  const sigFontSize = Math.max(5, Math.min(7, w * 0.07))

  return (
    <div
      style={{
        width: w,
        height: h,
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
      }}
    >
      <span
        style={{
          color: st.textColor,
          fontSize,
          // Secondary tier (Bold 700) below 32 px, primary (Black 900) above —
          // matches FontManager::secondary/primary handoff on the device.
          fontWeight: fontSize >= 32 ? 900 : 700,
          fontFamily: FONT_FAMILY,
          letterSpacing: '0.06em',
          // Tabular numerals keep the digits aligned without monospace fallback.
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {timeStr}
      </span>
      <span
        style={{
          position: 'absolute',
          top: 2,
          left: 3,
          fontSize: sigFontSize,
          fontFamily: FONT_FAMILY,
          fontWeight: 500,
          color: '#888888',
          lineHeight: 1,
          letterSpacing: '0.05em',
        }}
      >
        TIMER
      </span>
    </div>
  )
})
