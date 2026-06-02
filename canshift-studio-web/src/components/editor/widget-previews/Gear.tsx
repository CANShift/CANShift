// widget-previews/Gear.tsx — Large gear-position digit preview.
// The digit is the focal point and stands on its own — no header label is
// drawn (the digit communicates the signal). Issue #1244.

import { memo } from 'react'
import { FONT_FAMILY } from '../widgetPreview.styles'
import type { BaseRendererProps } from './shared'

export const GearPreview = memo(function GearPreview({ widget, w, h }: BaseRendererProps) {
  if (widget.config.type !== 'gear') return null
  const st = widget.style
  const fontSize = Math.min(w * 0.72, h * 0.85)

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
        boxSizing: 'border-box',
        overflow: 'hidden',
      }}
    >
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
    </div>
  )
})
