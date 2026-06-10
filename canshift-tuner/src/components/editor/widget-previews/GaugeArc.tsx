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

  const palette = paletteFillColor(cfg.iconName, valuePct, dangerPct)
  const inPaletteMode = palette !== undefined

  const textValueColor = inPaletteMode
    ? palette
    : valuePct >= dangerPct
      ? st.criticalColor
      : st.primaryColor

  const arcValueColor = inPaletteMode ? palette : interpolateGreenOrangeRed(valuePct)

  const cx = w / 2
  const r = Math.min(w * 0.45, h * 0.46)
  const cy = h * 0.5
  const valueYOffset = -8
  const unitYOffset = 16
  const strokeW = Math.max(5, r * 0.24)

  const revFlash = cfg.revFlash === true
  const showRevFlash = revFlash && revLimiting

  const valueFontSize = Math.max(11, Math.min(r * 0.55, h * 0.3, 42))
  const unitFontSize = Math.max(7, r * 0.2)

  return (
    <svg width={w} height={h} style={{ display: 'block', overflow: 'hidden' }} aria-hidden="true">
      {showRevFlash && <rect x={0} y={0} width={w} height={h} fill="#FF000022" />}
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
      <path
        d={gaugeArcD(cx, cy, r, 0, 1)}
        fill="none"
        stroke="#252525"
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
          if (frac === '') return valueStr
          return (
            <>
              <tspan>{int}</tspan>
              <tspan fontSize={valueFontSize * FRAC_FONT_SCALE}>{frac}</tspan>
            </>
          )
        })()}
      </text>
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
