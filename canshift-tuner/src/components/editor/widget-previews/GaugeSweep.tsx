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
const PAD_TOP = 4
const PAD_BOTTOM = 4
const TARGET_TICK_COUNT = 8
const KNEE_FRACTION = 0.32
const CP1_Y_RATIO = 0.35
const CP2_X_RATIO = 0.55
const LEFT_BAND = 12
const TOP_BAND = 32
const LABEL_BAND_OFFSET = 4
const VALUE_RIGHT_PAD = 6
const VALUE_BOTTOM_PAD = 6
const VALUE_FONT_SIZE = 30
const VALUE_UNIT_FONT_SIZE = 12
const VALUE_UNIT_GAP = 4
const TOP_LABEL_FONT_SIZE = 10
const TOP_LABEL_LEFT_PAD = 6
const TOP_LABEL_TOP_PAD = 12

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

interface CubicCps {
  p0x: number
  p0y: number
  cp1x: number
  cp1y: number
  cp2x: number
  cp2y: number
  p1x: number
  p1y: number
}

const cubicAt = (cp: CubicCps, t: number): { x: number; y: number } => {
  const u = 1 - t
  const uu = u * u
  const uuu = uu * u
  const tt = t * t
  const ttt = tt * t
  const x = uuu * cp.p0x + 3 * uu * t * cp.cp1x + 3 * u * tt * cp.cp2x + ttt * cp.p1x
  const y = uuu * cp.p0y + 3 * uu * t * cp.cp1y + 3 * u * tt * cp.cp2y + ttt * cp.p1y
  return { x, y }
}

const outerCps = (innerW: number, innerH: number): CubicCps => {
  const kneeX = innerW * KNEE_FRACTION
  return {
    p0x: 0,
    p0y: innerH,
    cp1x: 0,
    cp1y: innerH * CP1_Y_RATIO,
    cp2x: kneeX * CP2_X_RATIO,
    cp2y: 0,
    p1x: kneeX,
    p1y: 0,
  }
}

const innerCps = (innerW: number, innerH: number): CubicCps => {
  const kneeX = innerW * KNEE_FRACTION
  return {
    p0x: LEFT_BAND,
    p0y: innerH,
    cp1x: LEFT_BAND,
    cp1y: innerH * CP1_Y_RATIO + TOP_BAND * (1 - CP1_Y_RATIO),
    cp2x: LEFT_BAND + (kneeX - LEFT_BAND) * CP2_X_RATIO,
    cp2y: TOP_BAND,
    p1x: kneeX,
    p1y: TOP_BAND,
  }
}

const innerCurveYAt = (x: number, innerW: number, innerH: number): number => {
  const kneeX = innerW * KNEE_FRACTION
  if (x >= kneeX) return TOP_BAND
  if (x <= LEFT_BAND) return innerH
  const cps = innerCps(innerW, innerH)
  let lo = 0
  let hi = 1
  for (let i = 0; i < 18; i++) {
    const mid = (lo + hi) / 2
    const sx = cubicAt(cps, mid).x
    if (sx < x) lo = mid
    else hi = mid
  }
  return cubicAt(cps, (lo + hi) / 2).y
}

const buildOuterCurvePath = (innerW: number, innerH: number): string => {
  const c = outerCps(innerW, innerH)
  return `M ${c.p0x},${c.p0y.toFixed(2)} C ${c.cp1x},${c.cp1y.toFixed(2)} ${c.cp2x.toFixed(2)},${c.cp2y} ${c.p1x.toFixed(2)},${c.p1y} L ${innerW.toFixed(2)},0`
}

const buildInnerCurvePath = (innerW: number, innerH: number): string => {
  const c = innerCps(innerW, innerH)
  return `M ${c.p0x},${c.p0y.toFixed(2)} C ${c.cp1x},${c.cp1y.toFixed(2)} ${c.cp2x.toFixed(2)},${c.cp2y.toFixed(2)} ${c.p1x.toFixed(2)},${c.p1y.toFixed(2)} L ${innerW.toFixed(2)},${TOP_BAND.toFixed(2)}`
}

const buildOuterSilhouettePath = (innerW: number, innerH: number): string => {
  return `${buildOuterCurvePath(innerW, innerH)} L ${innerW.toFixed(2)},${innerH.toFixed(2)} L 0,${innerH.toFixed(2)} Z`
}

const buildInnerSilhouettePath = (innerW: number, innerH: number): string => {
  return `${buildInnerCurvePath(innerW, innerH)} L ${innerW.toFixed(2)},${innerH.toFixed(2)} L ${LEFT_BAND.toFixed(2)},${innerH.toFixed(2)} Z`
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
  const topLabelColor = '#888888'
  const unitColor = '#555555'

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
  const valueText = (cfg.prefix ?? '') + raw.toFixed(cfg.decimalPlaces)
  const unitText = cfg.suffix ?? signalUnit ?? ''

  const valueY = innerH - VALUE_BOTTOM_PAD
  const valueRightX = innerW - VALUE_RIGHT_PAD
  const unitX = valueRightX
  const valueX = valueRightX - VALUE_UNIT_GAP

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
          strokeOpacity={0.6}
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
          const isLegTick = tickX <= 0
          const labelX = isLegTick ? LEFT_BAND / 2 : tickX
          let labelY: number
          if (isLegTick) {
            labelY = innerH - 4
          } else {
            const innerY = innerCurveYAt(tickX, innerW, innerH)
            labelY = innerY + LABEL_BAND_OFFSET + 8
          }
          return (
            <text
              key={tick}
              x={labelX}
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
          x={TOP_LABEL_LEFT_PAD}
          y={TOP_LABEL_TOP_PAD}
          fontSize={TOP_LABEL_FONT_SIZE}
          fill={topLabelColor}
          textAnchor="start"
          style={{ letterSpacing: '0.12em', textTransform: 'uppercase' }}
        >
          {signalLabel}
        </text>

        {unitText && (
          <text
            x={unitX}
            y={valueY}
            fontSize={VALUE_UNIT_FONT_SIZE}
            fontWeight={600}
            fill={unitColor}
            textAnchor="end"
            style={{ letterSpacing: '0.04em' }}
          >
            {unitText}
          </text>
        )}
        <text
          x={unitText ? valueX - measureUnitWidth(unitText, VALUE_UNIT_FONT_SIZE) : valueRightX}
          y={valueY}
          fontSize={VALUE_FONT_SIZE}
          fontWeight={700}
          fill={st.textColor}
          textAnchor="end"
          style={{ letterSpacing: '0.02em' }}
        >
          {valueText}
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

const measureUnitWidth = (text: string, fontSize: number): number => {
  return text.length * fontSize * 0.55 + VALUE_UNIT_GAP
}
