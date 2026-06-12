import { memo } from 'react'
import { FONT_FAMILY } from '../widgetPreview.styles'
import type { BaseRendererProps } from './shared'

const DEMO_MMSS = '01:23'
const DEMO_SS_MMM = '12.847'

export const TimerPreview = memo(function TimerPreview({ widget, w, h }: BaseRendererProps) {
  if (widget.config.type !== 'timer') return null
  const cfg = widget.config
  const st = widget.style
  const timeStr = cfg.format === 'ss.mmm' ? DEMO_SS_MMM : DEMO_MMSS
  const fontSize = Math.max(9, Math.min(h * 0.44, w * 0.22))
  const sigFontSize = 9

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
          fontWeight: fontSize >= 32 ? 900 : 700,
          fontFamily: FONT_FAMILY,
          letterSpacing: '0.06em',
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
