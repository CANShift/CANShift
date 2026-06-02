// widget-previews/GaugeNumeric.tsx — Headline-numeric gauge preview.
// Mirrors firmware label_widget.cpp: signal-name header (or custom label) on
// top, value + unit centred, wide integers split last 3 digits onto a smaller
// font tier so 5200 reads as "5.200" — headline + subordinate trio.

import { memo } from 'react'
import { BLINK_ANIM, FONT_FAMILY } from '../widgetPreview.styles'
import { FRAC_FONT_SCALE, effectiveValue, splitDecimal } from './gauge-math'
import { type BaseRendererProps, formatSignalLabel } from './shared'

export interface GaugeNumericRendererProps extends BaseRendererProps {
  danger: boolean
  testValue?: number | null
  signalUnit: string
}

export const GaugeNumericPreview = memo(function GaugeNumericPreview({
  widget,
  w,
  h,
  danger,
  testValue,
  signalUnit,
}: GaugeNumericRendererProps) {
  if (widget.config.type !== 'gauge') return null
  const cfg = widget.config
  const st = widget.style

  const { raw: demoValue } = effectiveValue(testValue, cfg.minValue, cfg.maxValue)
  const valueOnly = demoValue.toFixed(cfg.decimalPlaces)
  const prefix = cfg.prefix ?? ''

  // Firmware label_widget.cpp uses style.textColor unconditionally for the
  // numeric value — no zone-based tinting at the value text level. Mirror that
  // here so studio is a 1:1 preview of the device.
  const valueColor = st.textColor

  // Auto signal-name header — pinned top-left, matches firmware
  // applySignalHeader() in canshift-firmware/src/ui/widget_label.cpp. The
  // header reserves a 14-px band at the TOP and the value floats below it.
  // Custom widget labels were dropped (issue #1244) — the auto-header is
  // the only label path now.
  const signalLabel = formatSignalLabel(widget.signal)
  const sigHeaderH = 14
  const availH = h - sigHeaderH

  // Headline value layout — wide ints (≥ 4 digits, no decimals) split last
  // 3 digits onto a smaller font tier so "5200" reads as "5" big + "200"
  // small in a narrow cell. The cap below sizes the run to fit `w` exactly,
  // accounting for outer padding + the unit suffix at FRAC_FONT_SCALE * 0.45.
  const valueStr = String(valueOnly)
  const intLen = valueStr.includes('.') ? valueStr.split('.')[0]!.length : valueStr.length
  const willSplit = !cfg.prefix && intLen > 3 && !valueStr.includes('.')
  const headChars = willSplit ? intLen - 3 : intLen
  const tailChars = willSplit ? 3 : valueStr.includes('.') ? valueStr.length - intLen : 0
  const unitChars = signalUnit.length
  // Effective char budget at the headline font size:
  //   - head chars at full font
  //   - tail (smaller integer trio + any fractional) at FRAC_FONT_SCALE
  //   - unit suffix at ~0.45 (rendered around 0.32 of value but Orbitron
  //     Medium 500 is narrower than Black 900, so the equivalent budget
  //     ends up around 0.45 × FRAC_FONT_SCALE of head font).
  const charBudget =
    headChars + tailChars * FRAC_FONT_SCALE + unitChars * FRAC_FONT_SCALE * 0.45
  // 0.68 = average Orbitron Black 900 advance width in em. 16-px outer
  // padding/gap stays unallocated so the run sits inside the cell with
  // breathing room even after the selection outline expands a few px.
  const fontSize = Math.max(10, Math.min(availH * 0.85, (w - 16) / (charBudget * 0.68)))

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
        // Reserve the band at the TOP so the auto-header sits above the value
        // — matches firmware applySignalHeader() in widget_label.cpp.
        padding: `${String(sigHeaderH + 2)}px 4px 2px`,
        boxSizing: 'border-box',
        overflow: 'hidden',
        gap: 0,
      }}
    >
      {/* Signal name auto-header — top-left, dim caps. Matches firmware
          applySignalHeader() position and padding (kEdgeInsetX=4, Y=1) in
          canshift-firmware/src/ui/widget_label.cpp. */}
      <span
        style={{
          position: 'absolute',
          top: 1,
          left: 4,
          fontSize: 11,
          fontFamily: FONT_FAMILY,
          fontWeight: 500,
          color: '#888888',
          lineHeight: 1,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          maxWidth: `calc(100% - 8px)`,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
        }}
      >
        {signalLabel.toUpperCase()}
      </span>
      {/* Value + unit row — value on the left, unit to its right at a smaller
          font, separated by a small gap. Mirrors firmware label_widget.cpp
          where the unit hugs the value baseline-aligned. The unit font is
          sized ~30 % of the value so it reads clearly subordinate without
          competing with the number. */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'baseline',
          justifyContent: 'center',
          gap: 4,
          width: '100%',
          flexShrink: 0,
        }}
      >
        {(() => {
          const { int, frac } = splitDecimal(valueOnly)
          // 4+ digit integers (RPM, mileage, oil-temp at high range, …) split
          // last 3 digits onto a smaller font tier so the headline reads as
          // "5.200" — "5" dominant, "200" subordinate — instead of a single
          // run that overflows narrow cells. Mirrors how telemetry HUDs
          // present thousands.
          const isWideInt = !prefix && int.length > 3 && frac === ''
          const intHead = isWideInt ? int.slice(0, -3) : int
          const intTail = isWideInt ? int.slice(-3) : ''
          return (
            <span
              style={{
                color: valueColor,
                fontFamily: FONT_FAMILY,
                fontWeight: 900,
                lineHeight: 1,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'clip',
                textAlign: 'center',
                animation: danger ? BLINK_ANIM : undefined,
              }}
            >
              {/* Orbitron matches firmware FontManager::primary at the
                  integer-part size. Fractional part renders at
                  FRAC_FONT_SCALE so AFR / voltage / lambda readouts
                  emphasise the headline number. Wide-int split (5.200)
                  reuses the same small tier for the trailing trio. */}
              <span style={{ fontSize }}>{prefix + intHead}</span>
              {intTail !== '' && (
                <span style={{ fontSize: fontSize * FRAC_FONT_SCALE }}>{intTail}</span>
              )}
              {frac !== '' && <span style={{ fontSize: fontSize * FRAC_FONT_SCALE }}>{frac}</span>}
            </span>
          )
        })()}
        {signalUnit !== '' && (
          <span
            style={{
              color: '#888888',
              fontSize: Math.max(8, Math.min(fontSize * 0.32, 14)),
              fontFamily: FONT_FAMILY,
              fontWeight: 500,
              lineHeight: 1,
              whiteSpace: 'nowrap',
              pointerEvents: 'none',
            }}
          >
            {signalUnit}
          </span>
        )}
      </div>
    </div>
  )
})
