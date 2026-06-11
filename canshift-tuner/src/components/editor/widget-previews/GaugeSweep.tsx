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
const CURVE_FRACTION = 0.32
const TARGET_TICK_COUNT = 8
const CHANNEL_THICKNESS = 10
const STROKE_W = 1.5

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

const buildChannelPath = (innerW: number, innerH: number, t: number): string => {
  const curveW = Math.max(t * 2 + 8, Math.min(innerW * CURVE_FRACTION, innerH * 1.2))
  return [
    `M 0,${String(innerH)}`,
    `Q 0,0 ${String(curveW)},0`,
    `L ${String(innerW)},0`,
    `L ${String(innerW)},${String(t)}`,
    `L ${String(curveW)},${String(t)}`,
    `Q ${String(t)},${String(t)} ${String(t)},${String(innerH)}`,
    'Z',
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

  const channelPath = buildChannelPath(innerW, innerH, CHANNEL_THICKNESS)
  const fillWidth = innerW * pct
  const clipId = `sweep-fill-${widget.id}`

  const trackColor = '#2A2A2A'
  const channelBg = '#161616'
  const sweepBg = '#0F0F0F'
  const baselineColor = '#2A2A2A'
  const tickColor = '#3A3A3A'
  const tickLabelColor = '#888888'
  const fillColor = beyondDanger ? '#FF4444' : st.primaryColor

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

        <defs>
          <clipPath id={clipId}>
            <rect x={0} y={0} width={fillWidth} height={innerH} />
          </clipPath>
        </defs>

        <path
          d={channelPath}
          fill={channelBg}
          stroke={trackColor}
          strokeWidth={STROKE_W}
          strokeLinejoin="round"
        />

        <g clipPath={`url(#${clipId})`}>
          <path d={channelPath} fill={fillColor} fillOpacity={0.85} stroke="none" />
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
