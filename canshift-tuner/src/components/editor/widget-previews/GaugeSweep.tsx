import { memo } from 'react'
import { FONT_FAMILY, thresholdPct } from '../widgetPreview.styles'
import { effectiveValue } from './gauge-math'
import { type BaseRendererProps, formatSignalLabel } from './shared'

export interface GaugeSweepRendererProps extends BaseRendererProps {
  danger: boolean
  testValue?: number | null
  signalUnit: string
}

const PAD_LEFT = 4
const PAD_RIGHT = 4
const PAD_TOP = 8
const PAD_BOTTOM = 4
const TARGET_TICK_COUNT = 8
const RISE_SAMPLES = 28
const KNEE_FRACTION = 0.28
const LEFT_BAND = 6
const TOP_BAND = 18
const LABEL_INSET = 12
const VALUE_LABEL_INSET_TOP = 6

const pickTickStep = (range: number): number => {
  if (range <= 0) return 1
  const rough = range / TARGET_TICK_COUNT
  const magnitude = Math.pow(10, Math.floor(Math.log10(rough)))
  const normalized = rough / magnitude
  let step = magnitude
  if (normalized >= 5) step = 5 * magnitude
  else if (normalized >= 2) step = 2 * magnitude
  return step
}

const formatTick = (value: number, step: number): string => {
  if (step >= 1000) return `${(value / 1000).toFixed(0)}`
  if (step >= 1) return value.toFixed(0)
  return value.toFixed(1)
}

const smootherstep = (t: number): number => {
  if (t <= 0) return 0
  if (t >= 1) return 1
  return t * t * t * (t * (t * 6 - 15) + 10)
}

const curveYAt = (x: number, innerW: number, innerH: number): number => {
  const kneeX = innerW * KNEE_FRACTION
  if (x >= kneeX) return 0
  const t = kneeX <= 0 ? 0 : x / kneeX
  return innerH * (1 - smootherstep(t))
}

const buildOuterCurvePath = (innerW: number, innerH: number): string => {
  const kneeX = innerW * KNEE_FRACTION
  const parts: string[] = []
  for (let i = 0; i <= RISE_SAMPLES; i++) {
    const t = i / RISE_SAMPLES
    const x = t * kneeX
    const y = innerH * (1 - smootherstep(t))
    parts.push(`${i === 0 ? 'M' : 'L'} ${x.toFixed(2)},${y.toFixed(2)}`)
  }
  parts.push(`L ${innerW.toFixed(2)},0`)
  return parts.join(' ')
}

const buildOuterSilhouettePath = (innerW: number, innerH: number): string => {
  const curve = buildOuterCurvePath(innerW, innerH)
  return `${curve} L ${innerW.toFixed(2)},${innerH.toFixed(2)} L 0,${innerH.toFixed(2)} Z`
}

const buildInnerCurvePath = (innerW: number, innerH: number): string => {
  const innerInnerW = Math.max(0, innerW - LEFT_BAND)
  const innerKneeX = innerInnerW * KNEE_FRACTION
  const innerRiseH = Math.max(0, innerH - TOP_BAND)
  const parts: string[] = []
  for (let i = 0; i <= RISE_SAMPLES; i++) {
    const t = i / RISE_SAMPLES
    const x = LEFT_BAND + t * innerKneeX
    const y = TOP_BAND + innerRiseH * (1 - smootherstep(t))
    parts.push(`${i === 0 ? 'M' : 'L'} ${x.toFixed(2)},${y.toFixed(2)}`)
  }
  parts.push(`L ${innerW.toFixed(2)},${TOP_BAND.toFixed(2)}`)
  return parts.join(' ')
}

const buildInnerSilhouettePath = (innerW: number, innerH: number): string => {
  const curve = buildInnerCurvePath(innerW, innerH)
  return `${curve} L ${innerW.toFixed(2)},${innerH.toFixed(2)} L ${LEFT_BAND.toFixed(2)},${innerH.toFixed(2)} Z`
}

const buildBandPath = (innerW: number, innerH: number): string => {
  return `${buildOuterSilhouettePath(innerW, innerH)} ${buildInnerSilhouettePath(innerW, innerH)}`
}

export const GaugeSweepPreview = memo(function GaugeSweepPreview({
  widget,
  w,
  h,
  danger,
  testValue,
  signalUnit,
}: GaugeSweepRendererProps) {
  if (widget.config.type !== 'gauge') return null
  const cfg = widget.config
  const st = widget.style

  const { pct, raw } = effectiveValue(testValue, cfg.minValue, cfg.maxValue)
  const dangerPct = thresholdPct(cfg.dangerLevel, cfg.minValue, cfg.maxValue)
  const beyondDanger = pct >= dangerPct

  const innerW = Math.max(1, w - PAD_LEFT - PAD_RIGHT)
  const innerH = Math.max(1, h - PAD_TOP - PAD_BOTTOM)

  const outerCurvePath = buildOuterCurvePath(innerW, innerH)
  const innerCurvePath = buildInnerCurvePath(innerW, innerH)
  const bandPath = buildBandPath(innerW, innerH)
  const fillWidth = innerW * pct
  const fillClipId = `sweep-left-${widget.id}`
  const restClipId = `sweep-right-${widget.id}`

  const fillColor = beyondDanger ? '#FF4444' : st.primaryColor
  const restColor = '#2A2A2A'
  const highlightColor = '#FFFFFF'
  const labelColor = '#FFFFFF'
  const signalLabelColor = '#888888'

  const range = cfg.maxValue - cfg.minValue
  const step = pickTickStep(range)
  const tickValues: number[] = []
  if (range > 0) {
    const firstTick = Math.ceil(cfg.minValue / step) * step
    for (let v = firstTick; v <= cfg.maxValue + 1e-6; v += step) {
      if (v < cfg.minValue - 1e-6) continue
      tickValues.push(v)
    }
  }

  const signalLabel = formatSignalLabel(widget.signal)
  const valueText = raw.toFixed(cfg.decimalPlaces)
  const valueStr = (cfg.prefix ?? '') + valueText + (cfg.suffix ?? (signalUnit ? signalUnit : ''))

  return (
    <svg
      width={w}
      height={h}
      viewBox={`0 0 ${String(w)} ${String(h)}`}
      style={{
        display: 'block',
        fontFamily: FONT_FAMILY,
        userSelect: 'none',
      }}
    >
      <g transform={`translate(${String(PAD_LEFT)}, ${String(PAD_TOP)})`}>
        <defs>
          <clipPath id={fillClipId}>
            <rect x={0} y={0} width={fillWidth} height={innerH} />
          </clipPath>
          <clipPath id={restClipId}>
            <rect x={fillWidth} y={0} width={innerW - fillWidth} height={innerH} />
          </clipPath>
        </defs>

        <g clipPath={`url(#${restClipId})`}>
          <path d={bandPath} fillRule="evenodd" fill={restColor} stroke="none" />
        </g>
        <g clipPath={`url(#${fillClipId})`}>
          <path d={bandPath} fillRule="evenodd" fill={fillColor} stroke="none" />
        </g>

        <path
          d={outerCurvePath}
          fill="none"
          stroke={highlightColor}
          strokeOpacity={0.55}
          strokeWidth={1.5}
        />
        <path
          d={innerCurvePath}
          fill="none"
          stroke={highlightColor}
          strokeOpacity={0.25}
          strokeWidth={1}
        />

        {tickValues.map((tick) => {
          if (range <= 0) return null
          const tickPct = (tick - cfg.minValue) / range
          const tickX = innerW * tickPct
          const onCurveY = curveYAt(tickX, innerW, innerH)
          const labelY = Math.min(innerH - 4, onCurveY + LABEL_INSET)
          return (
            <text
              key={tick}
              x={tickX}
              y={labelY}
              fontSize={10}
              fontWeight={700}
              fill={labelColor}
              textAnchor="middle"
              style={{ letterSpacing: '0.04em' }}
            >
              {formatTick(tick, step)}
            </text>
          )
        })}

        <text
          x={0}
          y={innerH - 2}
          fontSize={9}
          fill={signalLabelColor}
          textAnchor="start"
          style={{ letterSpacing: '0.08em', textTransform: 'uppercase' }}
        >
          {signalLabel}
        </text>
        <text
          x={innerW}
          y={VALUE_LABEL_INSET_TOP}
          fontSize={10}
          fill={st.textColor}
          textAnchor="end"
          style={{ fontWeight: 700 }}
        >
          {valueStr}
        </text>

        {danger && (
          <rect
            x={0}
            y={0}
            width={innerW}
            height={innerH}
            fill="none"
            stroke="#FF4444"
            strokeWidth={1}
            opacity={0.6}
          />
        )}
      </g>
    </svg>
  )
})
