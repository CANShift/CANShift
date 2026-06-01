// widget-previews/Bar.tsx — Horizontal bar widget preview.
// Mirrors firmware bar_widget.cpp (horizontal branch): label band on one
// side, square-cornered track on the other, threshold-coloured fill with
// optional translucent danger zone, signal name / user label, and a white
// value readout centred on the track.

import { memo } from 'react'
import {
  BLINK_ANIM,
  FONT_FAMILY,
  ZONE_DANGER,
  ZONE_NORMAL,
  paletteFillColor,
  thresholdPct,
} from '../widgetPreview.styles'
import { effectiveValue } from './gauge-math'
import { type BaseRendererProps, formatSignalLabel } from './shared'

export interface BarRendererProps extends BaseRendererProps {
  danger: boolean
  testValue?: number | null
  signalUnit: string
}

// Layout ratios mirrored from firmware bar_widget.cpp.
const BAND_RATIO = 0.25
const BAND_MIN_H = 14
const BAND_MAX_H = 24
const BAND_GAP = 2
const TRACK_PAD_X = 6
const VAL_MIN_TRACK_H = 14
const VAL_LARGE_TRACK_H = 24

const TRACK_BG = '#1C1C1C'
const SIGNAL_LABEL_RGB = '#888888'
const VALUE_TEXT_RGB = '#FFFFFF'
const DANGER_ZONE_OPA = '35'

export const BarPreview = memo(function BarPreview({
  widget,
  w,
  h,
  danger,
  testValue,
  signalUnit,
}: BarRendererProps) {
  if (widget.config.type !== 'bar') return null
  const cfg = widget.config
  const st = widget.style

  const minValue = cfg.minValue ?? 0
  const maxValue = cfg.maxValue ?? 100
  const dangerLevel = cfg.dangerLevel
  const dangerPct = dangerLevel !== undefined ? thresholdPct(dangerLevel, minValue, maxValue) : 1
  const { pct: valuePct, raw: demoValue } = effectiveValue(testValue, minValue, maxValue)

  // Fill colour priority — palette (#954) > threshold (#965). Without a
  // configured threshold the fill stays in the OK colour across the range.
  const paletteColor = paletteFillColor(cfg.iconName, valuePct, dangerPct)
  const inPaletteMode = paletteColor !== undefined
  const zoneFill =
    dangerLevel !== undefined && valuePct >= dangerPct ? ZONE_DANGER : ZONE_NORMAL
  const fillColor = paletteColor ?? zoneFill

  const labelText = cfg.label ?? ''
  const labelPos = cfg.labelPosition ?? 'top-center'
  // Band sits at top when no user label or labelPosition starts with 'top'.
  const noUserLabel = labelText === ''
  const labelIsTop = noUserLabel || labelPos.startsWith('top')

  const labelBandH = Math.max(BAND_MIN_H, Math.min(BAND_MAX_H, h * BAND_RATIO))
  const barH = Math.max(4, h - labelBandH - BAND_GAP)
  const trackY = labelIsTop ? labelBandH + BAND_GAP : 0
  const bandY = labelIsTop ? 0 : barH + BAND_GAP
  const trackW = Math.max(0, w - TRACK_PAD_X * 2)

  const sigFontSize = Math.max(7, Math.min(11, labelBandH * 0.7))
  const bandTextY = bandY + labelBandH / 2
  const showValue = barH >= VAL_MIN_TRACK_H
  const valueFontSize = Math.max(
    10,
    Math.min(barH * 0.55, barH >= VAL_LARGE_TRACK_H ? 14 : 12)
  )

  const prefix = cfg.prefix ?? ''
  const valueStr = `${prefix}${demoValue.toFixed(cfg.decimalPlaces)}`

  // Resolve the user-label x position to match its corner choice.
  const userLabelX =
    labelPos.endsWith('center') ? w / 2 : labelPos.endsWith('right') ? w - 4 : 4
  const userLabelAnchor: 'middle' | 'end' | 'start' = labelPos.endsWith('center')
    ? 'middle'
    : labelPos.endsWith('right')
      ? 'end'
      : 'start'

  return (
    <svg width={w} height={h} style={{ display: 'block', overflow: 'hidden' }} aria-hidden="true">
      {/* Track background — square corners, mirrors firmware applyBarTrack. */}
      <rect x={TRACK_PAD_X} y={trackY} width={trackW} height={barH} fill={TRACK_BG} />
      {/* Translucent danger band (single threshold, #965). Palette mode (#954)
          drops the band — the opaque palette fill carries the read on its own. */}
      {!inPaletteMode && dangerLevel !== undefined && dangerPct < 1 && (
        <rect
          x={TRACK_PAD_X + trackW * dangerPct}
          y={trackY}
          width={trackW * (1 - dangerPct)}
          height={barH}
          fill={ZONE_DANGER + DANGER_ZONE_OPA}
        />
      )}
      {/* Value fill — grows from left, square corners. */}
      <rect
        x={TRACK_PAD_X}
        y={trackY}
        width={trackW * valuePct}
        height={barH}
        fill={fillColor}
        style={{ animation: danger ? BLINK_ANIM : undefined }}
      />
      {/* Signal name auto-header — only when no user label. */}
      {noUserLabel && (
        <text
          x={4}
          y={bandTextY}
          textAnchor="start"
          dominantBaseline="middle"
          fill={SIGNAL_LABEL_RGB}
          fontSize={sigFontSize}
          fontFamily={FONT_FAMILY}
          fontWeight="500"
          letterSpacing="0.05em"
        >
          {formatSignalLabel(widget.signal)}
        </text>
      )}
      {/* Value readout — centred on the track, white per firmware spec. */}
      {showValue && (
        <text
          x={w / 2}
          y={trackY + barH / 2}
          textAnchor="middle"
          dominantBaseline="middle"
          fill={VALUE_TEXT_RGB}
          fontSize={valueFontSize}
          fontWeight="500"
          fontFamily={FONT_FAMILY}
          style={{ animation: danger ? BLINK_ANIM : undefined }}
        >
          {valueStr}
          {signalUnit}
        </text>
      )}
      {/* User-configured label — replaces the auto signal header in the band. */}
      {!noUserLabel && (
        <text
          x={userLabelX}
          y={bandTextY}
          textAnchor={userLabelAnchor}
          dominantBaseline="middle"
          fill={st.textColor + '77'}
          fontSize={sigFontSize}
          fontFamily={FONT_FAMILY}
          fontWeight="500"
          letterSpacing="0.05em"
        >
          {labelText}
        </text>
      )}
    </svg>
  )
})
