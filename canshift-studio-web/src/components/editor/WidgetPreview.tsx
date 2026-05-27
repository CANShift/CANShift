// WidgetPreview.tsx — Live-looking canvas previews for each widget type.
// Renders at the widget's display size (firmware px × SCALE).
// All previews use a fixed demo value at ~65 % of range so the shape is clear.

import * as React from 'react'
import { memo } from 'react'
import type { ComponentType } from 'react'
import type { Widget, WidgetConfig, PagePalette } from '@tmbk/canshift-core'
import { SensorIcon } from '../icons/SensorIcons'
import { displayLabelForSignal } from '../../utils/signalLabels'
import { useSignalStore } from '../../stores/signal.store'
import { MAXXECU_SIGNAL_UNITS } from '@tmbk/canshift-core'

// Built-in name → unit fallback table imported as a lean constant rather
// than derived at runtime from `ECU_PROFILES`. The full profiles registry
// drags the entire MaxxECU + OBD-II CAN-frame metadata into the renderer
// bundle (~30 KB) and pushes us over the studio size budget. The fallback
// only needs unit strings — keep the table in lockstep via canshift-core.
const FALLBACK_UNIT_TABLE: Readonly<Record<string, string>> = MAXXECU_SIGNAL_UNITS
import {
  FONT_FAMILY,
  BLINK_ANIM,
  ensureBlinkStyle,
  ZONE_NORMAL,
  ZONE_DANGER,
  paletteFillColor,
  thresholdPct,
  svgLabelAttrs,
  htmlLabelStyle,
} from './widgetPreview.styles'

// ---------------------------------------------------------------------------
// Gradient helper (issue #175) — green → orange → red across [0,1].
// Mirrors firmware's interpolateGreenOrangeRed() exactly. Returns a CSS
// "#RRGGBB" string suitable for SVG `stroke`.
// ---------------------------------------------------------------------------

const GRADIENT_GREEN = { r: 0x00, g: 0xcc, b: 0x44 }
const GRADIENT_ORANGE = { r: 0xff, g: 0x88, b: 0x00 }
const GRADIENT_RED = { r: 0xff, g: 0x44, b: 0x44 }

function clamp01(value: number): number {
  if (value < 0) return 0
  if (value > 1) return 1
  return value
}

function lerpChannel(a: number, b: number, t: number): number {
  const v = a + (b - a) * t
  if (v < 0) return 0
  if (v > 255) return 255
  return Math.round(v)
}

function rgbToHex(r: number, g: number, b: number): string {
  const hex = (n: number): string => n.toString(16).padStart(2, '0')
  return `#${hex(r)}${hex(g)}${hex(b)}`
}

export function interpolateGreenOrangeRed(pct: number): string {
  const p = clamp01(pct)
  if (p <= 0.5) {
    const t = p * 2
    return rgbToHex(
      lerpChannel(GRADIENT_GREEN.r, GRADIENT_ORANGE.r, t),
      lerpChannel(GRADIENT_GREEN.g, GRADIENT_ORANGE.g, t),
      lerpChannel(GRADIENT_GREEN.b, GRADIENT_ORANGE.b, t)
    )
  }
  const t = (p - 0.5) * 2
  return rgbToHex(
    lerpChannel(GRADIENT_ORANGE.r, GRADIENT_RED.r, t),
    lerpChannel(GRADIENT_ORANGE.g, GRADIENT_RED.g, t),
    lerpChannel(GRADIENT_ORANGE.b, GRADIENT_RED.b, t)
  )
}

// ---------------------------------------------------------------------------
// Palette → widget style resolver
// Mirrors the firmware's day/night handling: only the text colour follows the
// active page palette (so it stays legible against the swapped background).
// Per-widget primary / warning / critical colours and — crucially — the
// `iconName` sensor palette are PRESERVED so each gauge keeps its semantic
// colour. The previous implementation overrode every style slot with the page
// palette, which collapsed every gauge to the same uniform red on Canvas
// while the rail thumbnails (no palette prop, no override) kept their proper
// per-sensor colour — see issue #963.
// ---------------------------------------------------------------------------

function applyPalette(widget: Widget, palette: PagePalette): Widget {
  return {
    ...widget,
    style: {
      ...widget.style,
      textColor: palette.text,
    },
  }
}

const DEMO_PCT = 0.65 // fraction of range used for demo value

// ---------------------------------------------------------------------------
// Decimal split helper — splits "13.3" into "13" + ".3" so the fractional
// part can be rendered at a slightly smaller font. Used by numeric / arc
// readouts where decimals carry less perceptual weight than the integer
// part (AFR, voltage, lambda, pressures). Returns empty `frac` when no
// decimal point is present.
// ---------------------------------------------------------------------------

function splitDecimal(s: string): { int: string; frac: string } {
  const dot = s.indexOf('.')
  if (dot < 0) return { int: s, frac: '' }
  return { int: s.slice(0, dot), frac: s.slice(dot) }
}

// Fractional digits render at ~70 % of the integer-part font so they sit
// clearly subordinate without disappearing. Same ratio used in firmware
// label_widget.cpp / gauge_widget.cpp.
const FRAC_FONT_SCALE = 0.7

/**
 * Compute the percentage and raw value to render for a preview.
 * When the test-mode panel pins a value (testValue != null) the preview reads
 * from there; otherwise it falls back to the static demo percentage so the
 * inspector keeps a sensible visual when test mode is off.
 */
function effectiveValue(
  testValue: number | null | undefined,
  min: number,
  max: number
): { pct: number; raw: number } {
  const range = max - min || 1
  if (testValue == null || !Number.isFinite(testValue)) {
    return { pct: DEMO_PCT, raw: min + range * DEMO_PCT }
  }
  const pct = Math.max(0, Math.min(1, (testValue - min) / range))
  return { pct, raw: testValue }
}

function isDangerState(widget: Widget, testValue: number | null | undefined): boolean {
  const cfg = widget.config
  if (cfg.type !== 'gauge') return false
  const { pct } = effectiveValue(testValue, cfg.minValue, cfg.maxValue)
  const dangerPct = thresholdPct(cfg.dangerLevel, cfg.minValue, cfg.maxValue)
  return pct >= dangerPct
}

// ---------------------------------------------------------------------------
// Signal label helper — converts "coolant_temp_c" → "COOLANT TEMP C"
// ---------------------------------------------------------------------------

// Delegated to the shared dictionary so curated short labels (e.g. COOLANT
// rather than COOLANT TEMP C) are used everywhere — keeps studio in sync
// with firmware's `displayLabelForSignal()`.
function formatSignalLabel(signal: string): string {
  return displayLabelForSignal(signal)
}

// ---------------------------------------------------------------------------
// Arc-path helpers (SVG coordinate system: x→right, y→down)
// ---------------------------------------------------------------------------

/** Point on a circle in SVG coordinates. angleDeg=0 → right, 90 → down. */
function svgPt(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = (angleDeg * Math.PI) / 180
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) }
}

/**
 * SVG arc path string.
 * The gauge starts at SVG 135° (lower-left) and sweeps 270° clockwise to 45° (lower-right).
 * fromPct / toPct are fractions [0, 1] of the 270° sweep.
 */
function gaugeArcD(cx: number, cy: number, r: number, fromPct: number, toPct: number): string {
  const START_DEG = 135
  const SWEEP_DEG = 270
  const fromAngle = START_DEG + fromPct * SWEEP_DEG
  const toAngle = START_DEG + toPct * SWEEP_DEG
  const from = svgPt(cx, cy, r, fromAngle)
  const to = svgPt(cx, cy, r, toAngle)
  const sweep = (toPct - fromPct) * SWEEP_DEG
  const largeArc = sweep > 180 ? 1 : 0
  const rStr = String(r)
  const laStr = String(largeArc)
  return `M ${from.x.toFixed(2)} ${from.y.toFixed(2)} A ${rStr} ${rStr} 0 ${laStr} 1 ${to.x.toFixed(2)} ${to.y.toFixed(2)}`
}

// ---------------------------------------------------------------------------
// Per-renderer prop types — every renderer takes the same base shape, with a
// few flags layered on for variants that need them. Renderers narrow the
// `widget.config.type` discriminator inside their own body.
// ---------------------------------------------------------------------------

interface BaseRendererProps {
  widget: Widget
  w: number
  h: number
}

interface GaugeArcRendererProps extends BaseRendererProps {
  revLimiting: boolean
  danger: boolean
  testValue?: number | null
  signalUnit: string
}

interface GaugeBarRendererProps extends BaseRendererProps {
  danger: boolean
  testValue?: number | null
  signalUnit: string
}

interface GaugeNumericRendererProps extends BaseRendererProps {
  danger: boolean
  testValue?: number | null
  signalUnit: string
}

interface BarRendererProps extends BaseRendererProps {
  testValue?: number | null
  signalUnit: string
}

interface WarningRendererProps extends BaseRendererProps {
  noAnimate: boolean
}

interface ButtonRendererProps extends BaseRendererProps {
  active: boolean
}

// ---------------------------------------------------------------------------
// Gauge — Arc style
// ---------------------------------------------------------------------------

const GaugeArcPreview = memo(function GaugeArcPreview({
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

  // Arc fill style — issue #175. Defaults to 'zones' (legacy behaviour).
  const arcFillStyle = cfg.arcFillStyle ?? 'zones'
  const isGradient = arcFillStyle === 'gradient'

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

  // Arc fill colour:
  //   palette  — per-sensor opaque colour (issue #954).
  //   zones    — same threshold-tinted colour as the text (legacy behaviour).
  //   gradient — interpolated green→orange→red across the value range.
  const arcValueColor = inPaletteMode
    ? palette
    : isGradient
      ? interpolateGreenOrangeRed(valuePct)
      : textValueColor

  const cx = w / 2
  // Arc centered in widget; r chosen so arc never overflows (cy ± r stays inside h)
  const r = Math.min(w * 0.45, h * 0.46)
  const cy = h * 0.5 // true vertical center
  // Thicker stroke than the original 16 % — matches firmware kBgWidth=14 on
  // the smaller h=80 dashboard arcs so the trace stays readable.
  const strokeW = Math.max(5, r * 0.24)

  const revFlash = cfg.revFlash === true
  const showRevFlash = revFlash && revLimiting

  const valueFontSize = Math.max(9, Math.min(r * 0.38, h * 0.18, 28))
  const unitFontSize = Math.max(6, r * 0.17)

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
      {/* Zones mode only: danger sector tinting (issue #965). Palette mode
          (#954) skips this — the value arc is already opaque and semantic. */}
      {!isGradient && !inPaletteMode && (
        <path
          d={gaugeArcD(cx, cy, r, dangerPct, 1)}
          fill="none"
          stroke={st.criticalColor + '55'}
          strokeWidth={strokeW}
        />
      )}
      {/* Value arc — gradient mode tints with interpolated colour */}
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
        y={cy}
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
          y={cy + r * 0.32}
          textAnchor="middle"
          dominantBaseline="middle"
          fill={st.textColor + '77'}
          fontSize={unitFontSize}
          fontFamily={FONT_FAMILY}
        >
          {signalUnit}
        </text>
      )}
      {/* Widget label (user-configured, shown at bottom when set) */}
      {cfg.label &&
        (() => {
          const pos = cfg.labelPosition ?? 'top-left'
          const lAttrs = svgLabelAttrs(pos, w, h)
          return (
            <text
              x={lAttrs.x}
              y={lAttrs.y}
              textAnchor={lAttrs.textAnchor}
              dominantBaseline={lAttrs.dominantBaseline}
              fill={st.textColor + '77'}
              fontSize={Math.max(6, Math.min(9, w * 0.1))}
              fontFamily={FONT_FAMILY}
              fontWeight="500"
              letterSpacing="0.04em"
            >
              {cfg.label}
            </text>
          )
        })()}
    </svg>
  )
})

// ---------------------------------------------------------------------------
// Gauge — Vertical bar style (also renders horizontal when barOrientation='horizontal')
// ---------------------------------------------------------------------------

const GaugeBarPreview = memo(function GaugeBarPreview({
  widget,
  w,
  h,
  danger,
  testValue,
  signalUnit,
}: GaugeBarRendererProps) {
  if (widget.config.type !== 'gauge') return null
  const cfg = widget.config
  const st = widget.style

  const isHorizontal = cfg.barOrientation === 'horizontal'

  const dangerPct = thresholdPct(cfg.dangerLevel, cfg.minValue, cfg.maxValue)
  const { pct: valuePct, raw: demoValue } = effectiveValue(testValue, cfg.minValue, cfg.maxValue)

  const valueStr = demoValue.toFixed(cfg.decimalPlaces)
  const signalLabel = formatSignalLabel(widget.signal)

  // Issue #954 — sensor palette overrides the legacy zone tinting when the
  // gauge widget pins a known iconName. Issue #965 reduces the zone path to
  // a single threshold so a missing palette falls back to green/red on
  // dangerLevel alone.
  const paletteColor = paletteFillColor(cfg.iconName, valuePct, dangerPct)
  const inPaletteMode = paletteColor !== undefined
  const dangerZoneColor = valuePct >= dangerPct ? ZONE_DANGER : ZONE_NORMAL

  if (isHorizontal) {
    const fillColor = paletteColor ?? dangerZoneColor

    const labelPos = cfg.labelPosition ?? 'bottom-left'
    // Label band sits below the bar by default (issue #137). Users can still
    // pin it to the top via labelPosition, but the auto signal-name fallback
    // no longer forces the band to the top when no custom label is set.
    const labelIsTop = labelPos.startsWith('top')

    // Reserve a label band on one side; track takes the rest. The 14-px floor
    // matches the firmware's Orbitron Medium 12 line height — anything tighter
    // clips the value and signal name. Cap at 24 so the bar stays dominant
    // on tall widgets.
    const labelBandH = Math.max(14, Math.min(24, h * 0.25))
    const gap = 2
    const barH = Math.max(4, h - labelBandH - gap)
    const trackY = labelIsTop ? labelBandH + gap : 0
    const bandY = labelIsTop ? 0 : barH + gap
    const padX = 6
    const trackW = w - padX * 2

    const sigFontSize = Math.max(7, Math.min(11, labelBandH * 0.7))
    // Centre the inline-baseline text inside the band
    const bandTextY = bandY + labelBandH / 2

    return (
      <svg width={w} height={h} style={{ display: 'block' }} aria-hidden="true">
        {/* Track — square corners */}
        <rect x={padX} y={trackY} width={trackW} height={barH} fill="#1C1C1C" />
        {/* Palette mode (#954) drops the translucent zone band and tick — the
            opaque palette fill carries the read on its own. Issue #965
            collapses the legacy warn+danger bands to a single danger band. */}
        {!inPaletteMode && (
          <rect
            x={padX + trackW * dangerPct}
            y={trackY}
            width={(1 - dangerPct) * trackW}
            height={barH}
            fill={ZONE_DANGER + '35'}
          />
        )}
        {!inPaletteMode && (
          <line
            x1={padX + trackW * dangerPct}
            y1={trackY - 2}
            x2={padX + trackW * dangerPct}
            y2={trackY + barH + 2}
            stroke={ZONE_DANGER}
            strokeWidth={1}
            strokeDasharray="2 2"
          />
        )}
        {/* Fill — zone-coloured, square corners */}
        <rect
          x={padX}
          y={trackY}
          width={trackW * valuePct}
          height={barH}
          fill={fillColor}
          style={{ animation: danger ? BLINK_ANIM : undefined }}
        />
        {/* Signal label — only when no custom label is set */}
        {!cfg.label && (
          <text
            x={4}
            y={bandTextY}
            textAnchor="start"
            dominantBaseline="middle"
            fill="#888888"
            fontSize={sigFontSize}
            fontFamily={FONT_FAMILY}
            fontWeight="500"
            letterSpacing="0.05em"
          >
            {signalLabel}
          </text>
        )}
        {/* Value — white, centred ON the bar track (over the fill).
            Label tier (Medium 500) — matches FontManager::label on the
            firmware horizontal bar where the value sits in the 12–14 px band. */}
        {barH >= 14 && (
          <text
            x={w / 2}
            y={trackY + barH / 2}
            textAnchor="middle"
            dominantBaseline="middle"
            fill="#FFFFFF"
            fontSize={Math.max(10, Math.min(barH * 0.55, 14))}
            fontWeight="500"
            fontFamily={FONT_FAMILY}
            style={{ animation: danger ? BLINK_ANIM : undefined }}
          >
            {valueStr}
            {signalUnit}
          </text>
        )}
        {/* User label — sits in the band at the user-chosen horizontal corner */}
        {cfg.label && (
          <text
            x={labelPos.endsWith('center') ? w / 2 : labelPos.endsWith('right') ? w - 4 : 4}
            y={bandTextY}
            textAnchor={
              labelPos.endsWith('center') ? 'middle' : labelPos.endsWith('right') ? 'end' : 'start'
            }
            dominantBaseline="middle"
            fill={st.textColor + '77'}
            fontSize={sigFontSize}
            fontFamily={FONT_FAMILY}
            fontWeight="500"
            letterSpacing="0.05em"
          >
            {cfg.label}
          </text>
        )}
      </svg>
    )
  }

  // Vertical bar — palette wins when iconName resolves; otherwise the
  // single-threshold green/red zone tinting drives the fill (issue #965).
  const valueColor = paletteColor ?? dangerZoneColor

  // Bar track: 60 % of widget width, centered
  const bw = Math.max(10, w * 0.6)
  const padX = (w - bw) / 2
  // Top: signal label; bottom: value + unit on two lines
  const sigLabelH = Math.max(10, Math.min(h * 0.12, 14))
  const padTop = sigLabelH + 3
  const unitLineH = Math.max(8, Math.min(h * 0.09, 13))
  const valLineH = Math.max(10, Math.min(h * 0.14, 22))
  const padBot = valLineH + unitLineH + 6
  const trackH = Math.max(4, h - padTop - padBot)

  const fillY = padTop + trackH * (1 - valuePct)
  const fillH = trackH * valuePct

  const dangerY = padTop + trackH * (1 - dangerPct)

  const sigFontSize = Math.max(6, Math.min(sigLabelH * 0.82, w * 0.12))
  const valFontSize = Math.max(10, Math.min(valLineH * 0.9, w * 0.46))
  const unitFontSize = Math.max(7, Math.min(unitLineH * 0.85, w * 0.3))

  // Value/unit text — white below danger, critical above (issue #965).
  const valTextColor = valuePct >= dangerPct ? st.criticalColor : '#FFFFFF'
  const unitTextColor = valuePct >= dangerPct ? st.criticalColor + 'BB' : '#888888'

  return (
    <svg width={w} height={h} style={{ display: 'block' }} aria-hidden="true">
      {/* Signal name — top centre, dropped when the user supplies a label */}
      {!cfg.label && (
        <text
          x={w / 2}
          y={2}
          textAnchor="middle"
          dominantBaseline="hanging"
          fill="#888888"
          fontSize={sigFontSize}
          fontFamily={FONT_FAMILY}
          fontWeight="500"
          letterSpacing="0.04em"
        >
          {signalLabel}
        </text>
      )}
      {/* Track background — square corners */}
      <rect x={padX} y={padTop} width={bw} height={trackH} fill="#1C1C1C" />
      {/* Palette mode (#954) drops the translucent zone overlay/tick — the
          opaque palette fill carries the read on its own. Issue #965 keeps
          only the danger band when no palette is pinned. */}
      {!inPaletteMode && (
        <rect
          x={padX}
          y={dangerY}
          width={bw}
          height={dangerPct * trackH}
          fill={ZONE_DANGER + '35'}
        />
      )}
      {!inPaletteMode && (
        <line
          x1={padX - 3}
          y1={dangerY}
          x2={padX + bw + 3}
          y2={dangerY}
          stroke={ZONE_DANGER}
          strokeWidth={1}
          strokeDasharray="2 2"
        />
      )}
      {/* Value fill from bottom — square corners */}
      <rect
        x={padX}
        y={fillY}
        width={bw}
        height={fillH}
        fill={valueColor}
        style={{ animation: danger ? BLINK_ANIM : undefined }}
      />
      {/* Scale ticks — min/max on sides when space allows */}
      {padX >= 14 && (
        <>
          <text
            x={padX - 4}
            y={padTop + trackH}
            textAnchor="end"
            dominantBaseline="middle"
            fill="#383838"
            fontSize={Math.max(6, Math.min(8, w * 0.12))}
            fontFamily={FONT_FAMILY}
          >
            {cfg.minValue}
          </text>
          <text
            x={padX - 4}
            y={padTop}
            textAnchor="end"
            dominantBaseline="middle"
            fill="#383838"
            fontSize={Math.max(6, Math.min(8, w * 0.12))}
            fontFamily={FONT_FAMILY}
          >
            {cfg.maxValue}
          </text>
        </>
      )}
      {/* Value — white for max readability, warning/danger state changes color.
          Label tier (Medium 500) — vertical bar values render at 14–16 px,
          which is the FontManager::label band on the firmware. */}
      <text
        x={w / 2}
        y={h - padBot + valLineH * 0.88}
        textAnchor="middle"
        dominantBaseline="auto"
        fill={valTextColor}
        fontSize={valFontSize}
        fontWeight="500"
        fontFamily={FONT_FAMILY}
        style={{ animation: danger ? BLINK_ANIM : undefined }}
      >
        {valueStr}
      </text>
      {signalUnit !== '' && (
        <text
          x={w / 2}
          y={h - 3}
          textAnchor="middle"
          dominantBaseline="auto"
          fill={unitTextColor}
          fontSize={unitFontSize}
          fontFamily={FONT_FAMILY}
          fontWeight="500"
          letterSpacing="0.03em"
          style={{ animation: danger ? BLINK_ANIM : undefined }}
        >
          {signalUnit}
        </text>
      )}
      {/* Widget label */}
      {cfg.label &&
        (() => {
          const pos = cfg.labelPosition ?? 'top-left'
          const lAttrs = svgLabelAttrs(pos, w, h)
          return (
            <text
              x={lAttrs.x}
              y={lAttrs.y}
              textAnchor={lAttrs.textAnchor}
              dominantBaseline={lAttrs.dominantBaseline}
              fill={st.textColor + '77'}
              fontSize={Math.max(5, Math.min(8, w * 0.22))}
              fontFamily={FONT_FAMILY}
              fontWeight="500"
            >
              {cfg.label}
            </text>
          )
        })()}
    </svg>
  )
})

// ---------------------------------------------------------------------------
// Gauge — Numeric style
// ---------------------------------------------------------------------------

const GaugeNumericPreview = memo(function GaugeNumericPreview({
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

  const labelText = cfg.label ?? null
  const labelPos = cfg.labelPosition ?? 'top-left'

  // Suffix dropped unconditionally — see the value span below. The label name
  // already conveys the unit, and "195km/h" overflows 80-px-wide cells.
  // Matches firmware label_widget.cpp behaviour.

  // Signal name shown top-left when no custom label — matches firmware
  // applySignalHeader() in canshift-firmware/src/ui/widget_label.cpp, which
  // pins the auto-header to CfgLabelPos::TOP_LEFT (the previous bottom-left
  // placement in studio drifted out of sync after PR #967, issue #957).
  // The auto-header reserves a 14-px band at the TOP (Orbitron Medium 12 line
  // height) and the value floats below it.
  const showSignalHeader = labelText === null
  const signalLabel = formatSignalLabel(widget.signal)
  const sigHeaderH = showSignalHeader ? 14 : 0
  const availH = h - sigHeaderH

  // Inline layout — value occupies the full available band.
  const fontSize = Math.max(8, Math.min(availH * 0.72, w * 0.52))

  const isLabelTop = labelText !== null && labelPos.startsWith('top')
  const isLabelRight = labelPos.endsWith('right')
  const isLabelCenter = labelPos.endsWith('center')
  const labelAlign = isLabelCenter ? 'center' : isLabelRight ? 'right' : 'left'
  const labelFontSize = Math.max(6, Math.min(9, w * 0.1))

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
      {showSignalHeader && (
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
          }}
        >
          {signalLabel}
        </span>
      )}
      {/* Widget label overlay (user-configured) */}
      {labelText !== null && (
        <span
          style={{
            position: 'absolute',
            ...(isLabelTop ? { top: 2 } : { bottom: 2 }),
            ...(isLabelCenter
              ? { left: '50%', transform: 'translateX(-50%)' }
              : isLabelRight
                ? { right: 3 }
                : { left: 3 }),
            fontSize: labelFontSize,
            fontFamily: FONT_FAMILY,
            fontWeight: 500,
            color: '#888888',
            lineHeight: 1,
            whiteSpace: 'nowrap',
            letterSpacing: '0.04em',
            textAlign: labelAlign,
          }}
        >
          {labelText}
        </span>
      )}
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
                  integer-part size. The fractional part (".3", ".09", …) is
                  rendered at FRAC_FONT_SCALE of the integer size so AFR /
                  voltage / lambda / pressure readouts emphasise the headline
                  number while the decimal sits visibly subordinate. */}
              <span style={{ fontSize }}>{prefix + int}</span>
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

// ---------------------------------------------------------------------------
// Bar widget — horizontal progress bar
// ---------------------------------------------------------------------------

const BarWidgetPreview = memo(function BarWidgetPreview({
  widget,
  w,
  h,
  testValue,
  signalUnit,
}: BarRendererProps) {
  if (widget.config.type !== 'bar') return null
  const cfg = widget.config
  const st = widget.style

  // Standalone bar widgets default to a 0..100 percent range when min/max are
  // unset — keep the legacy display-as-percent behaviour in that case.
  const min = cfg.minValue ?? 0
  const max = cfg.maxValue ?? 100
  const { pct: valuePct, raw: rawValue } = effectiveValue(testValue, min, max)
  const fillW = w * valuePct
  const barH = Math.max(4, h * 0.35)
  const textY = (h - barH) / 2
  const valueStr =
    (cfg.prefix ?? '') +
    String(Math.round(testValue == null ? valuePct * 100 : rawValue)) +
    signalUnit
  const labelPos = cfg.labelPosition ?? 'bottom-center'
  const labelIsTop = labelPos === 'top-center'
  const signalLabel = formatSignalLabel(widget.signal)

  // Issue #954 — palette wins over the per-widget primaryColor when a known
  // sensor is pinned on the widget. dangerLevel is optional on standalone
  // bars (#965); fall back to the top of the range so the OK colour fills
  // the entire bar until a real threshold is configured.
  const dangerPct = cfg.dangerLevel !== undefined ? thresholdPct(cfg.dangerLevel, min, max) : 1.1
  const barFillColor = paletteFillColor(cfg.iconName, valuePct, dangerPct) ?? st.primaryColor

  return (
    <svg width={w} height={h} style={{ display: 'block' }} aria-hidden="true">
      {/* Track */}
      <rect x={0} y={(h - barH) / 2} width={w} height={barH} fill="#1C1C1C" />
      {/* Fill */}
      <rect x={0} y={(h - barH) / 2} width={fillW} height={barH} fill={barFillColor} />
      {/* Signal name — only when no custom label is set (avoid stacked text) */}
      {!cfg.label && (
        <text
          x={4}
          y={labelIsTop ? h - 3 : 3}
          textAnchor="start"
          dominantBaseline={labelIsTop ? 'auto' : 'hanging'}
          fill="#888888"
          fontSize={Math.max(5, Math.min(7, h * 0.22))}
          fontFamily={FONT_FAMILY}
          fontWeight="500"
          letterSpacing="0.05em"
        >
          {signalLabel}
        </text>
      )}
      {/* Value readout */}
      {h > 18 && (
        <text
          x={w / 2}
          y={textY > 10 ? textY - 2 : h - textY + 2}
          textAnchor="middle"
          dominantBaseline={textY > 10 ? 'auto' : 'hanging'}
          fill={st.textColor + 'BB'}
          fontSize={Math.max(7, Math.min(10, h * 0.28))}
          fontFamily={FONT_FAMILY}
        >
          {valueStr}
        </text>
      )}
      {/* Widget label */}
      {cfg.label && (
        <text
          x={w / 2}
          y={labelIsTop ? 8 : h - 3}
          textAnchor="middle"
          dominantBaseline={labelIsTop ? 'hanging' : 'auto'}
          fill={st.textColor + '77'}
          fontSize={Math.max(6, Math.min(9, h * 0.22))}
          fontFamily={FONT_FAMILY}
          fontWeight="500"
          letterSpacing="0.04em"
        >
          {cfg.label}
        </text>
      )}
    </svg>
  )
})

// ---------------------------------------------------------------------------
// Warning widget
// ---------------------------------------------------------------------------

const WarningPreview = memo(function WarningPreview({
  widget,
  w,
  h,
  noAnimate,
}: WarningRendererProps) {
  if (widget.config.type !== 'warning') return null
  const cfg = widget.config
  const st = widget.style
  const iconName = cfg.iconName ?? 'warning'
  const signalLabel = formatSignalLabel(widget.signal)
  const sigFontSize = Math.max(8, Math.min(h * 0.16, w * 0.13, 14))
  const labelH = sigFontSize + 4
  const iconSize = Math.min(w * 0.55, h - labelH - 8, 64)
  const labelText = cfg.label ?? null
  const labelPos = cfg.labelPosition ?? 'top-left'

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
        gap: 4,
        background: st.criticalColor + '22',
        borderRadius: 0,
        // Side-page thumbnails pass noAnimate to suppress the alert flash so
        // they show layout, not live state (issue #144).
        animation: noAnimate ? undefined : BLINK_ANIM,
        overflow: 'hidden',
        boxSizing: 'border-box',
      }}
    >
      <SensorIcon name={iconName} size={iconSize} color={st.criticalColor} />
      {labelText === null && (
        <span
          style={{
            fontSize: sigFontSize,
            fontFamily: FONT_FAMILY,
            fontWeight: 500,
            color: st.criticalColor + '99',
            lineHeight: 1,
            whiteSpace: 'nowrap',
            letterSpacing: '0.06em',
          }}
        >
          {signalLabel}
        </span>
      )}
      {labelText !== null && (
        <span
          style={{
            ...htmlLabelStyle(labelPos),
            fontSize: Math.max(6, Math.min(9, w * 0.12)),
            fontFamily: FONT_FAMILY,
            fontWeight: 500,
            color: st.textColor + '77',
            lineHeight: 1,
            letterSpacing: '0.04em',
            whiteSpace: 'nowrap',
          }}
        >
          {labelText}
        </span>
      )}
    </div>
  )
})

// ---------------------------------------------------------------------------
// Button widget
// ---------------------------------------------------------------------------

/**
 * Compute icon and font-size metrics for the button preview. Exported so unit
 * tests can lock in the formula without rendering. Identical for idle/active.
 */
export function computeButtonPreviewMetrics(
  w: number,
  h: number,
  showIcon: boolean
): { iconSize: number; fontSize: number } {
  // Column layout (icon on top, label below): icon takes ~half the vertical
  // budget, label gets the rest. Label can use the full width minus padding
  // since it sits on its own row.
  const iconSize = showIcon ? Math.max(10, Math.min(h * 0.5, h - 18, 30)) : 0
  const labelBudget = w - 12
  // When the icon is hidden the label can fill more vertical space.
  const verticalBudget = showIcon ? h * 0.32 : h * 0.48
  const fontSize = Math.max(8, Math.min(verticalBudget, labelBudget * 0.28))
  return { iconSize, fontSize }
}

const ButtonPreview = memo(function ButtonPreview({ widget, w, h, active }: ButtonRendererProps) {
  if (widget.config.type !== 'button') return null
  const cfg = widget.config
  const st = widget.style
  const iconName = cfg.iconName ?? null
  const showIcon = cfg.showIcon === true && iconName !== null
  const showLabel = cfg.showLabel !== false
  // Scale icon and label font to fill the assigned widget dimensions
  const { iconSize, fontSize } = computeButtonPreviewMetrics(w, h, showIcon)

  // Two-state button colours (#146): cfg.colors.normal / cfg.colors.active.
  // Older configs without `colors` still fall back to the legacy widget.style.
  const normalColor = cfg.colors?.normal ?? st.primaryColor
  const activeColor = cfg.colors?.active ?? st.primaryColor
  const stateColor = active ? activeColor : normalColor
  const bgColor = active ? activeColor + '55' : normalColor + '18'
  const borderColor = active ? activeColor : st.secondaryColor
  const textColor = active ? stateColor : st.textColor

  return (
    <div
      style={{
        width: w,
        height: h,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 2,
        padding: '4px 6px',
        boxSizing: 'border-box',
        background: bgColor,
        border: `1px solid ${borderColor}`,
        borderRadius: 0,
        // `overflow: visible` so a long label that wraps under the icon stays
        // readable — issue request: "au pire le texte passe dessous, jamais
        // crop". The button container still clips at the widget bounds via
        // its parent WidgetBox (which keeps `overflow: hidden`).
        overflow: 'visible',
        transition: 'background 0.1s, border-color 0.1s',
      }}
    >
      {showIcon && (
        <div style={{ flexShrink: 0, display: 'flex' }}>
          <SensorIcon name={iconName} size={iconSize} color={textColor + 'CC'} />
        </div>
      )}
      {showLabel && (
        <span
          style={{
            color: textColor,
            fontSize,
            fontWeight: 500,
            // Allow wrap to a second line if the label doesn't fit on one
            // line at the computed font size. Word-break handles tokens that
            // are individually longer than the available width.
            whiteSpace: 'normal',
            wordBreak: 'break-word',
            overflow: 'visible',
            letterSpacing: '0.04em',
            minWidth: 0,
            textAlign: 'center',
            lineHeight: 1.1,
          }}
        >
          {cfg.label}
        </span>
      )}
    </div>
  )
})

// ---------------------------------------------------------------------------
// Gear widget — large gear-position digit
// ---------------------------------------------------------------------------

const GearPreview = memo(function GearPreview({ widget, w, h }: BaseRendererProps) {
  if (widget.config.type !== 'gear') return null
  const cfg = widget.config
  const st = widget.style
  const signalLabel = formatSignalLabel(widget.signal)
  const sigHeaderH = Math.max(8, Math.min(h * 0.16, 13))
  // Digit fills available height below signal label
  const fontSize = Math.min(w * 0.72, (h - sigHeaderH) * 0.85)
  const sigFontSize = Math.max(5, Math.min(sigHeaderH * 0.72, w * 0.12))
  const labelText = cfg.label ?? null
  // Default to bottom — gear digit is the focal point, the label belongs
  // under it (issue #136).
  const labelPos = cfg.labelPosition ?? 'bottom-left'

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
        paddingTop: sigHeaderH,
        boxSizing: 'border-box',
        overflow: 'hidden',
      }}
    >
      {labelText === null && (
        <span
          style={{
            position: 'absolute',
            top: 2,
            left: 0,
            right: 0,
            textAlign: 'center',
            fontSize: sigFontSize,
            fontFamily: FONT_FAMILY,
            fontWeight: 500,
            color: '#888888',
            lineHeight: 1,
            letterSpacing: '0.05em',
          }}
        >
          {signalLabel}
        </span>
      )}
      {/* Centering wrapper — Orbitron Black single-digit side bearings are
          asymmetric, so flex `alignItems: center` alone shifts the glyph off
          the visual axis. Wrapping the span in a full-width flex row and
          giving the span `width: 100%` + `textAlign: center` anchors the
          digit on the container midline (issue #513). */}
      <div
        style={{
          display: 'flex',
          width: '100%',
          justifyContent: 'center',
          alignItems: 'center',
          flexShrink: 0,
        }}
      >
        <span
          style={{
            color: st.primaryColor,
            fontSize,
            // Primary value tier — gear digit is the focal element. Black 900
            // matches FontManager::primary on the device.
            fontWeight: 900,
            fontFamily: FONT_FAMILY,
            lineHeight: 1,
            textAlign: 'center',
            width: '100%',
            display: 'inline-block',
          }}
        >
          3
        </span>
      </div>
      {labelText !== null && (
        <span
          style={{
            ...htmlLabelStyle(labelPos),
            fontSize: Math.max(6, Math.min(9, w * 0.12)),
            fontFamily: FONT_FAMILY,
            fontWeight: 500,
            color: st.textColor + '77',
            lineHeight: 1,
            letterSpacing: '0.04em',
            whiteSpace: 'nowrap',
          }}
        >
          {labelText}
        </span>
      )}
    </div>
  )
})

// ---------------------------------------------------------------------------
// Timer widget
// ---------------------------------------------------------------------------

const TimerPreview = memo(function TimerPreview({ widget, w, h }: BaseRendererProps) {
  if (widget.config.type !== 'timer') return null
  const cfg = widget.config
  const st = widget.style
  const timeStr = cfg.format === 'ss.mmm' ? '12.847' : '01:23'
  const fontSize = Math.max(9, Math.min(h * 0.44, w * 0.22))
  const sigFontSize = Math.max(5, Math.min(7, w * 0.07))
  const labelText = cfg.label ?? null
  const labelPos = cfg.labelPosition ?? 'top-left'

  return (
    <div
      style={{
        width: w,
        height: h,
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
      }}
    >
      <span
        style={{
          color: st.textColor,
          fontSize,
          // Secondary tier (Bold 700) — matches FontManager::secondary on the
          // device; firmware switches to primary (Black 900) at ≥110 px height.
          // Orbitron's tabular digits keep the read aligned without `monospace`.
          fontWeight: fontSize >= 32 ? 900 : 700,
          fontFamily: FONT_FAMILY,
          letterSpacing: '0.06em',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {timeStr}
      </span>
      {labelText === null && (
        <span
          style={{
            position: 'absolute',
            top: 2,
            left: 3,
            fontSize: sigFontSize,
            fontFamily: FONT_FAMILY,
            fontWeight: 500,
            color: '#888888',
            lineHeight: 1,
            letterSpacing: '0.05em',
          }}
        >
          TIMER
        </span>
      )}
      {labelText !== null && (
        <span
          style={{
            ...htmlLabelStyle(labelPos),
            fontSize: Math.max(6, Math.min(9, w * 0.12)),
            fontFamily: FONT_FAMILY,
            fontWeight: 500,
            color: st.textColor + '77',
            lineHeight: 1,
            letterSpacing: '0.04em',
            whiteSpace: 'nowrap',
          }}
        >
          {labelText}
        </span>
      )}
    </div>
  )
})

// ---------------------------------------------------------------------------
// Image widget
// ---------------------------------------------------------------------------

const ImagePreview = memo(function ImagePreview({ widget, w, h }: BaseRendererProps) {
  if (widget.config.type !== 'image') return null
  const cfg = widget.config
  const st = widget.style
  const pts = [
    `${String(w * 0.2)},${String(h * 0.72)}`,
    `${String(w * 0.42)},${String(h * 0.38)}`,
    `${String(w * 0.58)},${String(h * 0.55)}`,
    `${String(w * 0.7)},${String(h * 0.42)}`,
    `${String(w * 0.82)},${String(h * 0.72)}`,
  ].join(' ')
  const labelText = cfg.label ?? null
  const labelPos = cfg.labelPosition ?? 'top-left'

  return (
    <svg width={w} height={h} style={{ display: 'block' }} aria-hidden="true">
      <rect x={4} y={4} width={w - 8} height={h - 8} fill="#1A1A1A" rx={3} stroke="#2A2A2A" />
      {/* Mountain / photo icon */}
      <polyline points={pts} fill="none" stroke="#333333" strokeWidth={1.5} />
      <circle cx={w * 0.3} cy={h * 0.35} r={Math.min(w, h) * 0.06} fill="#333333" />
      <text
        x={w / 2}
        y={h - 6}
        textAnchor="middle"
        dominantBaseline="auto"
        fill="#2A2A2A"
        fontSize={Math.max(5, Math.min(7, w * 0.07))}
        fontFamily={FONT_FAMILY}
        fontWeight="500"
        letterSpacing="0.05em"
      >
        IMAGE
      </text>
      {labelText !== null &&
        (() => {
          const a = svgLabelAttrs(labelPos, w, h)
          return (
            <text
              x={a.x}
              y={a.y}
              textAnchor={a.textAnchor}
              dominantBaseline={a.dominantBaseline}
              fill={st.textColor + '77'}
              fontSize={Math.max(6, Math.min(9, w * 0.12))}
              fontFamily={FONT_FAMILY}
              fontWeight="500"
              letterSpacing="0.04em"
            >
              {labelText}
            </text>
          )
        })()}
    </svg>
  )
})

// ---------------------------------------------------------------------------
// Renderer dispatch — keyed by WidgetConfig['type']. Each entry receives the
// fully-resolved widget plus the variant flags it cares about. The map shape
// gives O(1) lookup, exhaustiveness via discriminated-union narrowing, and
// makes adding a new widget type a single-line change.
// ---------------------------------------------------------------------------

interface RenderContext {
  w: number
  h: number
  revLimiting: boolean
  buttonActive: boolean
  noAnimate: boolean
  testValue: number | null
  danger: boolean
  /**
   * Unit string resolved by `WidgetPreviewImpl` from the bound signal's
   * `unit` field (signals.json), with the widget's explicit `cfg.suffix`
   * winning as a manual override. Mirrors firmware
   * `WidgetHelpers::resolveDisplayUnit`. Empty string when no unit applies.
   */
  signalUnit: string
}

type WidgetTypeKey = WidgetConfig['type']

type RendererDispatch = Record<
  WidgetTypeKey,
  (widget: Widget, ctx: RenderContext) => React.JSX.Element | null
>

// Gauge has three sub-styles; pick the matching memoized renderer.
const gaugeRendererByDisplay: Record<
  'arc' | 'bar' | 'numeric',
  ComponentType<GaugeArcRendererProps | GaugeBarRendererProps | GaugeNumericRendererProps>
> = {
  arc: GaugeArcPreview as ComponentType<
    GaugeArcRendererProps | GaugeBarRendererProps | GaugeNumericRendererProps
  >,
  bar: GaugeBarPreview as ComponentType<
    GaugeArcRendererProps | GaugeBarRendererProps | GaugeNumericRendererProps
  >,
  numeric: GaugeNumericPreview as ComponentType<
    GaugeArcRendererProps | GaugeBarRendererProps | GaugeNumericRendererProps
  >,
}

const RENDERERS: RendererDispatch = {
  gauge: (widget, ctx) => {
    if (widget.config.type !== 'gauge') return null
    const Renderer = gaugeRendererByDisplay[widget.config.displayStyle]
    return (
      <Renderer
        widget={widget}
        w={ctx.w}
        h={ctx.h}
        revLimiting={ctx.revLimiting}
        danger={ctx.danger}
        testValue={ctx.testValue}
        signalUnit={ctx.signalUnit}
      />
    )
  },
  bar: (widget, ctx) => (
    <BarWidgetPreview
      widget={widget}
      w={ctx.w}
      h={ctx.h}
      testValue={ctx.testValue}
      signalUnit={ctx.signalUnit}
    />
  ),
  warning: (widget, ctx) => (
    <WarningPreview widget={widget} w={ctx.w} h={ctx.h} noAnimate={ctx.noAnimate} />
  ),
  button: (widget, ctx) => (
    <ButtonPreview widget={widget} w={ctx.w} h={ctx.h} active={ctx.buttonActive} />
  ),
  gear: (widget, ctx) => <GearPreview widget={widget} w={ctx.w} h={ctx.h} />,
  timer: (widget, ctx) => <TimerPreview widget={widget} w={ctx.w} h={ctx.h} />,
  image: (widget, ctx) => <ImagePreview widget={widget} w={ctx.w} h={ctx.h} />,
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

interface WidgetPreviewProps {
  widget: Widget
  /** Display width in pixels (= layout.w × SCALE) */
  displayW: number
  /** Display height in pixels (= layout.h × SCALE) */
  displayH: number
  /** Page palette — when provided, overrides widget style semantic colors */
  palette?: PagePalette
  /** When true, rev-flash gauges show the activated (red) state */
  revLimiting?: boolean
  /** When true, button widget renders in its active/pressed visual state */
  buttonActive?: boolean
  /** When true, suppresses all CSS animations (blink, flash). Use for thumbnails. */
  noAnimate?: boolean
  /** Test-mode injected raw value for this widget's signal; null falls back to the demo percentage. */
  testValue?: number | null
}

/**
 * Resolve the unit string to display next to a widget's value. Mirrors the
 * firmware helper `WidgetHelpers::resolveDisplayUnit`: an explicit per-widget
 * `cfg.suffix` wins as a manual override, otherwise the unit declared on the
 * bound signal (signals.json) is used. Returns "" when no unit applies so
 * callers don't have to special-case nullish handling.
 *
 * Subscribes to `useSignalStore` so a unit change in the signal mapper
 * surfaces in every preview without a manual refresh.
 */
function useResolvedSignalUnit(widget: Widget): string {
  const signals = useSignalStore((s) => s.signals)
  const cfg = widget.config
  const configSuffix =
    cfg.type === 'gauge' || cfg.type === 'bar' || cfg.type === 'timer'
      ? ((cfg as { suffix?: string }).suffix ?? '')
      : ''
  if (configSuffix !== '') return configSuffix
  if (!widget.signal) return ''
  const def = signals.find((s) => s.name === widget.signal)
  if (def?.unit) return def.unit
  // Hook-level fallback: even if the user's signal store doesn't carry the
  // bound name (custom profile, partial import, …), look the unit up in the
  // built-in MaxxECU table so standard names still show their units. Beats
  // the previous behaviour where the preview ran with no units at all when
  // localStorage held a non-empty but mismatched catalog (which the
  // store-level fallback couldn't reach).
  return FALLBACK_UNIT_TABLE[widget.signal] ?? ''
}

function WidgetPreviewImpl({
  widget,
  displayW: rawW,
  displayH: rawH,
  palette,
  revLimiting = false,
  buttonActive = false,
  noAnimate = false,
  testValue = null,
}: WidgetPreviewProps) {
  // Clamp to zero — SVG attributes reject negative values, which can occur
  // transiently when the parent container hasn't laid out yet or scale is < 1.
  const w = Math.max(0, rawW)
  const h = Math.max(0, rawH)
  if (!noAnimate) ensureBlinkStyle()

  const resolved = palette ? applyPalette(widget, palette) : widget
  const danger = noAnimate ? false : isDangerState(resolved, testValue)
  const signalUnit = useResolvedSignalUnit(resolved)

  const ctx: RenderContext = {
    w,
    h,
    revLimiting: noAnimate ? false : revLimiting,
    buttonActive,
    noAnimate,
    testValue,
    danger,
    signalUnit,
  }

  // Exhaustive dispatch — TypeScript enforces every WidgetConfig['type'] has
  // a renderer entry; missing entries fail typecheck on the RENDERERS object.
  const render = RENDERERS[resolved.config.type]
  return render(resolved, ctx)
}

// React.memo with shallow prop comparison — `widget` and `palette` are stable
// across store updates thanks to immer (unchanged entries keep the same ref),
// so unrelated changes (selection, drag of another widget) no longer rerun
// every preview's SVG path math. The leaf renderers are individually memoized
// so even when this wrapper rerenders, only the renderer whose own props
// changed will actually do work.
export const WidgetPreview = memo(WidgetPreviewImpl)
