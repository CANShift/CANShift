import { memo } from 'react'
import { FONT_FAMILY, thresholdPct } from '../widgetPreview.styles'
import { effectiveValue } from './gauge-math'
import { type BaseRendererProps, formatSignalLabel } from './shared'

export interface GaugeSweepRendererProps extends BaseRendererProps {
  danger: boolean
  testValue?: number | null
  signalUnit: string
}

const PAD_LEFT = 12
const PAD_RIGHT = 10
const PAD_TOP = 14
const PAD_BOTTOM = 16
const CURVE_FRACTION = 0.18
const TARGET_TICK_COUNT = 8

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
  if (step >= 1000) return `${(value / 1000).toFixed(0)}k`
  if (step >= 1) return value.toFixed(0)
  return value.toFixed(1)
}

const buildSweepPath = (innerW: number, innerH: number): string => {
  const curveW = Math.max(12, Math.min(innerW * CURVE_FRACTION, innerH * 1.2))
  const startX = 0
  const startY = innerH
  const cornerEndX = curveW
  const cornerEndY = 0
  const controlX = curveW * 0.45
  const controlY = innerH * 0.45
  return [
    `M ${String(startX)},${String(startY)}`,
    `Q ${String(controlX)},${String(controlY)} ${String(cornerEndX)},${String(cornerEndY)}`,
    `L ${String(innerW)},${String(cornerEndY)}`,
  ].join(' ')
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

  const path = buildSweepPath(innerW, innerH)
  const fillWidth = innerW * pct
  const clipId = `sweep-fill-${widget.id}`

  const trackColor = '#1F1F1F'
  const sweepBg = '#0F0F0F'
  const baselineColor = '#2A2A2A'
  const tickColor = '#3A3A3A'
  const tickLabelColor = '#888888'
  const fillColor = beyondDanger ? '#FF4444' : st.primaryColor
  const fillStroke = beyondDanger ? '#FF8866' : st.primaryColor

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
        background: sweepBg,
        fontFamily: FONT_FAMILY,
        userSelect: 'none',
      }}
    >
      <text
        x={PAD_LEFT}
        y={PAD_TOP - 4}
        fontSize={9}
        fill={tickLabelColor}
        textAnchor="start"
        style={{ letterSpacing: '0.06em', textTransform: 'uppercase' }}
      >
        {signalLabel}
      </text>
      <text
        x={w - PAD_RIGHT}
        y={PAD_TOP - 4}
        fontSize={10}
        fill={st.textColor}
        textAnchor="end"
        style={{ fontWeight: 700 }}
      >
        {valueStr}
      </text>

      <g transform={`translate(${String(PAD_LEFT)}, ${String(PAD_TOP)})`}>
        <line
          x1={0}
          y1={innerH + 0.5}
          x2={innerW}
          y2={innerH + 0.5}
          stroke={baselineColor}
          strokeWidth={1}
        />
        <path d={path} fill="none" stroke={trackColor} strokeWidth={3} strokeLinecap="round" />

        <defs>
          <clipPath id={clipId}>
            <rect x={0} y={0} width={fillWidth} height={innerH} />
          </clipPath>
        </defs>
        <g clipPath={`url(#${clipId})`}>
          <path d={path} fill="none" stroke={fillStroke} strokeWidth={3} strokeLinecap="round" />
          <path
            d={`${path} L ${String(innerW)},${String(innerH)} L 0,${String(innerH)} Z`}
            fill={fillColor}
            fillOpacity={0.32}
            stroke="none"
          />
        </g>

        {tickValues.map((tick) => {
          const tickPct = (tick - cfg.minValue) / range
          const tickX = innerW * tickPct
          const tickInDanger = tick >= cfg.dangerLevel
          const tickColorActive = tickInDanger ? '#FF8800' : tickColor
          return (
            <g key={tick}>
              <line x1={tickX} y1={2} x2={tickX} y2={9} stroke={tickColorActive} strokeWidth={1} />
              <text
                x={tickX}
                y={innerH + 11}
                fontSize={8}
                fill={tickLabelColor}
                textAnchor="middle"
              >
                {formatTick(tick, step)}
              </text>
            </g>
          )
        })}

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
