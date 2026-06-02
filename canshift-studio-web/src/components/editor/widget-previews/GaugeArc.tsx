// widget-previews/GaugeArc.tsx — Arc-style gauge preview.
// 270° sweep starting at SVG 135° (lower-left), tinted by either the
// per-sensor palette (#954) or the green→orange→red gradient (#175).

import { memo } from 'react'
import { BLINK_ANIM, FONT_FAMILY, paletteFillColor, thresholdPct } from '../widgetPreview.styles'
import {
  FRAC_FONT_SCALE,
  effectiveValue,
  gaugeArcD,
  interpolateGreenOrangeRed,
  splitDecimal,
} from './gauge-math'
import { type BaseRendererProps, formatSignalLabel } from './shared'

export interface GaugeArcRendererProps extends BaseRendererProps {
  revLimiting: boolean
  danger: boolean
  testValue?: number | null
  signalUnit: string
}

export const GaugeArcPreview = memo(function GaugeArcPreview({
  widget,
  w,
  h,
  revLimiting,
  danger,
  testValue,
  signalUnit,
}: GaugeArcRendererProps) {
  if (widget.config.type !== 'gauge') return null
  const cfg = widget.config
  const st = widget.style

  const dangerPct = thresholdPct(cfg.dangerLevel, cfg.minValue, cfg.maxValue)
  const { pct: valuePct, raw: demoValue } = effectiveValue(testValue, cfg.minValue, cfg.maxValue)

  const valueStr = demoValue.toFixed(cfg.decimalPlaces)

  // Issue #954 — sensor palette wins when the widget pins a known iconName.
  // The opaque per-sensor colour fills below `dangerLevel` and the warning
  // colour above; the zone-tinted background sectors are dropped so the read
  // is "single solid colour grows from min toward max".
  const palette = paletteFillColor(cfg.iconName, valuePct, dangerPct)
  const inPaletteMode = palette !== undefined

  // Threshold-tinted text colour. Single-threshold tier (issue #965): below
  // dangerPct → primary, above → critical. Palette mode tints the text in
  // the palette colour so the readout matches the arc fill.
  const textValueColor = inPaletteMode
    ? palette
    : valuePct >= dangerPct
      ? st.criticalColor
      : st.primaryColor

  // Arc fill colour — gradient by default. Legacy 'zones' fill style was
  // dropped from the picker so every arc gauge reads as a smooth
  // green→orange→red interpolation across the value range. Palette mode
  // still wins when iconName resolves a sensor entry.
  const arcValueColor = inPaletteMode ? palette : interpolateGreenOrangeRed(valuePct)

  const cx = w / 2
  // Arc centered in widget; r chosen so arc never overflows (cy ± r stays inside h)
  const r = Math.min(w * 0.45, h * 0.46)
  const cy = h * 0.5 // true vertical center
  // Issue #1241: value text and unit sit above/below the geometric centre so
  // the bottom-anchored widget label doesn't collide with the numeric readout
  // on dense 160×112 dashboards. Mirrors the constants in
  // canshift-firmware/src/ui/widgets/gauge_widget.cpp (kValueRowYOffset = -8,
  // kUnitLabelYOffset = +16). Firmware is canonical for widget visuals.
  const valueYOffset = -8
  const unitYOffset = 16
  // Thicker stroke than the original 16 % — matches firmware kBgWidth=14 on
  // the smaller h=80 dashboard arcs so the trace stays readable.
  const strokeW = Math.max(5, r * 0.24)

  const revFlash = cfg.revFlash === true
  const showRevFlash = revFlash && revLimiting

  // Bumped from r*0.38/h*0.18/28 — value text was reading subordinate to
  // the arc trace at 80-px-tall dashboard cells. The new ceiling keeps the
  // glyph inside the arc's inner radius (no clip) while letting it dominate.
  const valueFontSize = Math.max(11, Math.min(r * 0.55, h * 0.3, 42))
  const unitFontSize = Math.max(7, r * 0.2)

  return (
    <svg width={w} height={h} style={{ display: 'block', overflow: 'hidden' }} aria-hidden="true">
      {/* Rev-flash background fill */}
      {showRevFlash && <rect x={0} y={0} width={w} height={h} fill="#FF000022" />}
      {/* Rev-flash indicator ring */}
      {revFlash && (
        <circle
          cx={cx}
          cy={cy}
          r={r + strokeW * 0.6}
          fill="none"
          stroke="#FF0000"
          strokeWidth={showRevFlash ? 3 : 1.5}
          opacity={showRevFlash ? 1 : 0.45}
          strokeDasharray={showRevFlash ? undefined : '4 3'}
        />
      )}
      {/* Background arc — gray base track in both modes. */}
      <path
        d={gaugeArcD(cx, cy, r, 0, 1)}
        fill="none"
        stroke="#252525"
        strokeWidth={strokeW}
        strokeLinecap="butt"
      />
      {/* Value arc — gradient interpolates green→orange→red across the
          range. Legacy zones-mode tinting was dropped along with the picker
          so every arc reads as a smooth fill. */}
      <path
        d={gaugeArcD(cx, cy, r, 0, valuePct)}
        fill="none"
        stroke={arcValueColor}
        strokeWidth={strokeW}
        strokeLinecap="butt"
        style={{ animation: danger ? BLINK_ANIM : undefined }}
      />
      {/* Inner circle, top-of-arc duplicate label and the white indicator
          needle were all dropped per user spec — the arc trace + the centred
          numeric value carry the read on their own. */}
      {/* Value text — center of arc. Threshold-tinted in BOTH modes.
          Primary value tier — Black 900 matches FontManager::primary.
          Fractional digits render at FRAC_FONT_SCALE of the integer part so
          decimals on AFR / voltage / lambda / pressure readouts sit
          subordinate to the headline number. */}
      <text
        x={cx}
        y={cy + valueYOffset}
        textAnchor="middle"
        dominantBaseline="middle"
        fill={textValueColor}
        fontSize={valueFontSize}
        fontWeight="900"
        fontFamily={FONT_FAMILY}
        style={{ animation: danger ? BLINK_ANIM : undefined }}
      >
        {(() => {
          const { int, frac } = splitDecimal(valueStr)
          if (frac === '') return valueStr
          return (
            <>
              <tspan>{int}</tspan>
              <tspan fontSize={valueFontSize * FRAC_FONT_SCALE}>{frac}</tspan>
            </>
          )
        })()}
      </text>
      {/* Suffix / unit — defaults to the bound signal's `unit` (signals.json)
          via `signalUnit`; an explicit `cfg.suffix` would have won at the
          resolver layer so we don't special-case it here. */}
      {signalUnit !== '' && (
        <text
          x={cx}
          y={cy + unitYOffset}
          textAnchor="middle"
          dominantBaseline="middle"
          fill={st.textColor + '77'}
          fontSize={unitFontSize}
          fontFamily={FONT_FAMILY}
        >
          {signalUnit}
        </text>
      )}
      {/* Auto signal-name header — pinned bottom-left under the arc. Issue
          #1244: custom widget labels were removed; the signal name in dim
          uppercase is the only label path now. */}
      <text
        x={4}
        y={h - 4}
        textAnchor="start"
        dominantBaseline="auto"
        fill="#888888"
        fontSize={Math.max(6, Math.min(9, w * 0.1))}
        fontFamily={FONT_FAMILY}
        fontWeight="500"
        letterSpacing="0.06em"
        style={{ textTransform: 'uppercase' }}
      >
        {formatSignalLabel(widget.signal).toUpperCase()}
      </text>
    </svg>
  )
})
