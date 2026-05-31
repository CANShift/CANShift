// widget-previews/Gear.tsx — Large gear-position digit preview.
// The digit is the focal point; the signal name renders as a dim caps header
// above when the user hasn't set a custom label (issue #136 / #513).

import { memo } from 'react'
import { FONT_FAMILY, htmlLabelStyle } from '../widgetPreview.styles'
import { type BaseRendererProps, formatSignalLabel } from './shared'

export const GearPreview = memo(function GearPreview({ widget, w, h }: BaseRendererProps) {
  if (widget.config.type !== 'gear') return null
  const cfg = widget.config
  const st = widget.style
  const signalLabel = formatSignalLabel(widget.signal)
  const sigHeaderH = Math.max(8, Math.min(h * 0.16, 13))
  // Digit fills available height below signal label
  const fontSize = Math.min(w * 0.72, (h - sigHeaderH) * 0.85)
  const sigFontSize = Math.max(5, Math.min(sigHeaderH * 0.72, w * 0.12))
  const labelText = cfg.label ?? null
  // Default to bottom — gear digit is the focal point, the label belongs
  // under it (issue #136).
  const labelPos = cfg.labelPosition ?? 'bottom-left'

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
        paddingTop: sigHeaderH,
        boxSizing: 'border-box',
        overflow: 'hidden',
      }}
    >
      {labelText === null && (
        <span
          style={{
            position: 'absolute',
            top: 2,
            left: 0,
            right: 0,
            textAlign: 'center',
            fontSize: sigFontSize,
            fontFamily: FONT_FAMILY,
            fontWeight: 500,
            color: '#888888',
            lineHeight: 1,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
          }}
        >
          {signalLabel.toUpperCase()}
        </span>
      )}
      {/* Centering wrapper — Orbitron Black single-digit side bearings are
          asymmetric, so flex `alignItems: center` alone shifts the glyph off
          the visual axis. Wrapping the span in a full-width flex row and
          giving the span `width: 100%` + `textAlign: center` anchors the
          digit on the container midline (issue #513). */}
      <div
        style={{
          display: 'flex',
          width: '100%',
          justifyContent: 'center',
          alignItems: 'center',
          flexShrink: 0,
        }}
      >
        <span
          style={{
            color: st.primaryColor,
            fontSize,
            // Primary value tier — gear digit is the focal element. Black 900
            // matches FontManager::primary on the device.
            fontWeight: 900,
            fontFamily: FONT_FAMILY,
            lineHeight: 1,
            textAlign: 'center',
            width: '100%',
            display: 'inline-block',
          }}
        >
          3
        </span>
      </div>
      {labelText !== null && (
        <span
          style={{
            ...htmlLabelStyle(labelPos),
            fontSize: Math.max(6, Math.min(9, w * 0.12)),
            fontFamily: FONT_FAMILY,
            fontWeight: 500,
            color: st.textColor + '77',
            lineHeight: 1,
            letterSpacing: '0.06em',
            whiteSpace: 'nowrap',
            textTransform: 'uppercase',
          }}
        >
          {labelText.toUpperCase()}
        </span>
      )}
    </div>
  )
})
