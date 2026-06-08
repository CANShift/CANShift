// widget-previews/Warning.tsx — Threshold-driven alert preview.
// Mirrors firmware warning_widget.cpp: translucent critical background that
// blinks while the alert is active, an icon centred above the auto signal
// name. Custom labels were dropped (issue #1244).

import { memo } from 'react'
import { SensorIcon } from '../../icons/SensorIcons'
import { BLINK_ANIM, FONT_FAMILY } from '../widgetPreview.styles'
import { type BaseRendererProps, formatSignalLabel } from './shared'

export interface WarningRendererProps extends BaseRendererProps {
  /** When true, suppress the blink animation (used by thumbnails). */
  noAnimate: boolean
}

const DEFAULT_ICON = 'warning' as const

export const WarningPreview = memo(function WarningPreview({
  widget,
  w,
  h,
  noAnimate,
}: WarningRendererProps) {
  if (widget.config.type !== 'warning') return null
  const cfg = widget.config
  const st = widget.style

  const iconName = cfg.iconName ?? DEFAULT_ICON
  // Match firmware's 28-px floor on the signal label band (warning_widget.cpp).
  const sigFontSize = Math.max(8, Math.min(h * 0.16, w * 0.13, 14))
  const labelH = sigFontSize + 4
  const iconSize = Math.max(0, Math.min(w * 0.55, h - labelH - 8, 64))
  const showSignalLabel = h >= 28

  return (
    <div
      style={{
        width: w,
        height: h,
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
        background: st.criticalColor + '22',
        borderRadius: 0,
        // Thumbnails pass noAnimate to suppress the alert flash so they show
        // layout rather than live state (issue #144).
        animation: noAnimate ? undefined : BLINK_ANIM,
        overflow: 'hidden',
        boxSizing: 'border-box',
      }}
    >
      <SensorIcon name={iconName} size={iconSize} color={st.criticalColor} />
      {showSignalLabel && (
        <span
          style={{
            fontSize: sigFontSize,
            fontFamily: FONT_FAMILY,
            fontWeight: 500,
            color: st.criticalColor + '99',
            lineHeight: 1,
            whiteSpace: 'nowrap',
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
          }}
        >
          {formatSignalLabel(widget.signal).toUpperCase()}
        </span>
      )}
    </div>
  )
})
