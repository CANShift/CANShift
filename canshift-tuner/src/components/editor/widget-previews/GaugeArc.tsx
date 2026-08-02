import { memo } from 'react'
import { GAUGE_ARC, GAUGE_TRACK_COLORS, STALE_PLACEHOLDER } from '@tmbk/canshift-core'
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
  unbound?: boolean
}

const SIGNAL_LABEL_FONT_SIZE = 9

export const GaugeArcPreview = memo(function GaugeArcPreview({
  widget,
  w,
  h,
  revLimiting,
  danger,
  testValue,
  unbound = false,
}: GaugeArcRendererProps) {
  if (widget.config.type !== 'gauge') return null
  const cfg = widget.config
  const st = widget.style

  const dangerPct = thresholdPct(cfg.dangerLevel, cfg.minValue, cfg.maxValue)
  const bound = effectiveValue(testValue, cfg.minValue, cfg.maxValue)
  const valuePct = unbound ? 0 : bound.pct

  const valueStr = unbound ? STALE_PLACEHOLDER : bound.raw.toFixed(cfg.decimalPlaces)

  const zonesMode = cfg.arcFillStyle === 'zones'
  const gradientMode = cfg.arcFillStyle === 'gradient'
  const palette = zonesMode ? paletteFillColor(cfg.iconName, valuePct, dangerPct) : undefined
  const inPaletteMode = palette !== undefined
  const inDanger = valuePct >= dangerPct

  const inkColor = inDanger ? st.criticalColor : st.textColor

  const textValueColor = inPaletteMode
    ? palette
    : zonesMode
      ? inDanger
        ? st.criticalColor
        : st.primaryColor
      : inkColor

  const arcValueColor = inPaletteMode
    ? palette
    : gradientMode || zonesMode
      ? interpolateGreenOrangeRed(valuePct)
      : inkColor

  const trackColor =
    inPaletteMode || gradientMode ? GAUGE_TRACK_COLORS.gradient : GAUGE_TRACK_COLORS.plain

  const cx = w / 2
  const cy = h * 0.5
  const valueYOffset = 0
  const maxOuterR = Math.min(w, h) / 2 - GAUGE_ARC.containerPadding / 2
  const idealR = maxOuterR / (1 + GAUGE_ARC.strokeRatio / 2)
  const strokeW = Math.max(GAUGE_ARC.strokeWidthFloor, idealR * GAUGE_ARC.strokeRatio)
  const r = maxOuterR - strokeW / 2

  const revFlash = cfg.revFlash === true
  const showRevFlash = revFlash && revLimiting

  const valueFontSize = Math.max(11, Math.min(r * 0.55, h * 0.3, 42))

  return (
    <svg width={w} height={h} style={{ display: 'block', overflow: 'hidden' }} aria-hidden="true">
      {showRevFlash && <rect x={0} y={0} width={w} height={h} fill="#FF000022" />}
      {revFlash && (
        <circle
          cx={cx}
          cy={cy}
          r={Math.min(r + strokeW * 0.6, maxOuterR - 1.5)}
          fill="none"
          stroke="#FF0000"
          strokeWidth={showRevFlash ? 3 : 1.5}
          opacity={showRevFlash ? 1 : 0.45}
          strokeDasharray={showRevFlash ? undefined : '4 3'}
        />
      )}
      <path
        d={gaugeArcD(cx, cy, r, 0, 1)}
        fill="none"
        stroke={trackColor}
        strokeWidth={strokeW}
        strokeLinecap="butt"
      />
      <path
        d={gaugeArcD(cx, cy, r, 0, valuePct)}
        fill="none"
        stroke={arcValueColor}
        strokeWidth={strokeW}
        strokeLinecap="butt"
        style={{ animation: danger ? BLINK_ANIM : undefined }}
      />
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
          if (frac !== '') {
            return (
              <>
                <tspan>{int}</tspan>
                <tspan fontSize={valueFontSize * FRAC_FONT_SCALE}>{frac}</tspan>
              </>
            )
          }
          const absInt = int.startsWith('-') ? int.slice(1) : int
          if (absInt.length > 3) {
            const sign = int.startsWith('-') ? '-' : ''
            const head = absInt.slice(0, -3)
            const tail = absInt.slice(-3)
            return (
              <>
                <tspan>{sign + head}</tspan>
                <tspan fontSize={valueFontSize * FRAC_FONT_SCALE}>{tail}</tspan>
              </>
            )
          }
          return valueStr
        })()}
      </text>
      <text
        x={4}
        y={SIGNAL_LABEL_FONT_SIZE + 4}
        textAnchor="start"
        dominantBaseline="auto"
        fill="#888888"
        fontSize={SIGNAL_LABEL_FONT_SIZE}
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
