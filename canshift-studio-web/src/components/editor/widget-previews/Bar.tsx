// widget-previews/Bar.tsx — Horizontal / vertical bar widget preview.
// Mirrors firmware bar_widget.cpp: label band on one side, square-cornered
// track on the other, threshold-coloured fill with optional translucent
// danger zone, signal name / user label, and a white value readout.
// Schema field `barOrientation` (#1232 flag) drives the layout choice; the
// firmware vertical branch is in buildVertical() in bar_widget.cpp.

import { memo } from 'react'
import type { Widget, WidgetConfig } from '@tmbk/canshift-core'
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

// Layout ratios mirrored from firmware bar_widget.cpp (horizontal branch).
const BAND_RATIO = 0.25
const BAND_MIN_H = 14
const BAND_MAX_H = 24
const BAND_GAP = 2
const TRACK_PAD_X = 6
const VAL_MIN_TRACK_H = 14
const VAL_LARGE_TRACK_H = 24

// Vertical-branch ratios (mirror computeVertLayout in bar_widget.cpp).
const VERT_TRACK_W_RATIO = 0.6
const VERT_MIN_BAR_W = 28
const VERT_LARGE_BREAK_H = 80

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

  const isVertical = cfg.barOrientation === 'vertical'
  const prefix = cfg.prefix ?? ''
  const valueStr = `${prefix}${demoValue.toFixed(cfg.decimalPlaces)}`

  return (
    <svg width={w} height={h} style={{ display: 'block', overflow: 'hidden' }} aria-hidden="true">
      {isVertical
        ? renderVertical({
            cfg,
            st,
            w,
            h,
            valuePct,
            dangerPct,
            dangerLevel,
            inPaletteMode,
            fillColor,
            danger,
            valueStr,
            signalUnit,
            signal: widget.signal ?? '',
          })
        : renderHorizontal({
            cfg,
            st,
            w,
            h,
            valuePct,
            dangerPct,
            dangerLevel,
            inPaletteMode,
            fillColor,
            danger,
            valueStr,
            signalUnit,
            signal: widget.signal ?? '',
          })}
    </svg>
  )
})

interface BranchProps {
  cfg: Extract<WidgetConfig, { type: 'bar' }>
  st: Widget['style']
  w: number
  h: number
  valuePct: number
  dangerPct: number
  dangerLevel: number | undefined
  inPaletteMode: boolean
  fillColor: string
  danger: boolean
  valueStr: string
  signalUnit: string
  signal: string
}

function renderHorizontal({
  cfg,
  st,
  w,
  h,
  valuePct,
  dangerPct,
  dangerLevel,
  inPaletteMode,
  fillColor,
  danger,
  valueStr,
  signalUnit,
  signal,
}: BranchProps): React.JSX.Element {
  const labelText = cfg.label ?? ''
  const labelPos = cfg.labelPosition ?? 'top-center'
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

  const userLabelX =
    labelPos.endsWith('center') ? w / 2 : labelPos.endsWith('right') ? w - 4 : 4
  const userLabelAnchor: 'middle' | 'end' | 'start' = labelPos.endsWith('center')
    ? 'middle'
    : labelPos.endsWith('right')
      ? 'end'
      : 'start'

  return (
    <>
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
          {formatSignalLabel(signal)}
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
    </>
  )
}

function renderVertical({
  cfg,
  w,
  h,
  valuePct,
  dangerPct,
  dangerLevel,
  inPaletteMode,
  fillColor,
  danger,
  valueStr,
  signalUnit,
  signal,
}: BranchProps): React.JSX.Element {
  // Mirror computeVertLayout in bar_widget.cpp.
  const barW = Math.max(VERT_MIN_BAR_W, w * VERT_TRACK_W_RATIO)
  const padX = (w - barW) / 2
  const sigLabelH = h >= VERT_LARGE_BREAK_H ? 14 : 12
  const valLabelH = h >= VERT_LARGE_BREAK_H ? 16 : 14
  const suffixH = h >= VERT_LARGE_BREAK_H ? 12 : 10
  const padTop = sigLabelH + 3
  const padBot = valLabelH + suffixH + 6
  const trackH = Math.max(4, h - padTop - padBot)

  const noUserLabel = (cfg.label ?? '') === ''
  const fillH = trackH * valuePct
  const fillY = padTop + trackH - fillH
  const dangerH = trackH * (1 - dangerPct)

  return (
    <>
      {/* Track background — full track rectangle. */}
      <rect x={padX} y={padTop} width={barW} height={trackH} fill={TRACK_BG} />
      {/* Top-anchored danger band (#965). Palette mode drops the band. */}
      {!inPaletteMode && dangerLevel !== undefined && dangerPct < 1 && dangerH > 0 && (
        <rect
          x={padX}
          y={padTop}
          width={barW}
          height={dangerH}
          fill={ZONE_DANGER + DANGER_ZONE_OPA}
        />
      )}
      {/* Value fill — anchored at the bottom of the track, grows upwards. */}
      <rect
        x={padX}
        y={fillY}
        width={barW}
        height={fillH}
        fill={fillColor}
        style={{ animation: danger ? BLINK_ANIM : undefined }}
      />
      {/* Signal label — top centre. Dropped when the user set a custom label. */}
      {noUserLabel && (
        <text
          x={w / 2}
          y={sigLabelH / 2 + 1}
          textAnchor="middle"
          dominantBaseline="middle"
          fill={SIGNAL_LABEL_RGB}
          fontSize={sigLabelH}
          fontFamily={FONT_FAMILY}
          fontWeight="500"
          letterSpacing="0.05em"
        >
          {formatSignalLabel(signal)}
        </text>
      )}
      {/* User-configured label — replaces the signal header on top. */}
      {!noUserLabel && (
        <text
          x={w / 2}
          y={sigLabelH / 2 + 1}
          textAnchor="middle"
          dominantBaseline="middle"
          fill={SIGNAL_LABEL_RGB}
          fontSize={sigLabelH}
          fontFamily={FONT_FAMILY}
          fontWeight="500"
          letterSpacing="0.05em"
        >
          {cfg.label}
        </text>
      )}
      {/* Value readout — bottom centre, primary colour per firmware. */}
      <text
        x={w / 2}
        y={h - suffixH - 2 - valLabelH / 2}
        textAnchor="middle"
        dominantBaseline="middle"
        fill={fillColor}
        fontSize={valLabelH}
        fontWeight="500"
        fontFamily={FONT_FAMILY}
        style={{ animation: danger ? BLINK_ANIM : undefined }}
      >
        {valueStr}
      </text>
      {/* Suffix below the value readout — vertical layout hides the inline
          suffix and shows it as a separate dim label, mirroring firmware. */}
      {signalUnit !== '' && (
        <text
          x={w / 2}
          y={h - suffixH / 2 - 1}
          textAnchor="middle"
          dominantBaseline="middle"
          fill={SIGNAL_LABEL_RGB}
          fontSize={suffixH}
          fontFamily={FONT_FAMILY}
        >
          {signalUnit}
        </text>
      )}
    </>
  )
}
