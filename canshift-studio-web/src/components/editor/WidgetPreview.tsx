// WidgetPreview.tsx — Live-looking canvas previews for each widget type.
// Renders at the widget's display size (firmware px × SCALE).
// All previews use a fixed demo value at ~65 % of range so the shape is clear.

import * as React from 'react'
import { memo } from 'react'
import type { ComponentType } from 'react'
import type { Widget, WidgetConfig, PagePalette } from '@tmbk/canshift-core'
import { useSignalStore } from '../../stores/signal.store'
import { MAXXECU_SIGNAL_UNITS } from '@tmbk/canshift-core'
import { ButtonPreview } from './widget-previews/Button'
import { GearPreview } from './widget-previews/Gear'
import { formatSignalLabel } from './widget-previews/shared'

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

interface GaugeNumericRendererProps extends BaseRendererProps {
  danger: boolean
  testValue?: number | null
  signalUnit: string
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
      {/* Widget label — pinned bottom-left under the arc on arc gauges only.
          Uppercase + dim weight so it reads as a caption without competing
          with the value. */}
      {cfg.label && (
        <text
          x={4}
          y={h - 4}
          textAnchor="start"
          dominantBaseline="auto"
          fill={st.textColor + '77'}
          fontSize={Math.max(6, Math.min(9, w * 0.1))}
          fontFamily={FONT_FAMILY}
          fontWeight="500"
          letterSpacing="0.06em"
          style={{ textTransform: 'uppercase' }}
        >
          {cfg.label.toUpperCase()}
        </text>
      )}
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
  // Signal name shown top-left when no custom label — matches firmware
  // applySignalHeader() in canshift-firmware/src/ui/widget_label.cpp, which
  // pins the auto-header to CfgLabelPos::TOP_LEFT. The auto-header reserves
  // a 14-px band at the TOP and the value floats below it.
  const showSignalHeader = labelText === null
  const signalLabel = formatSignalLabel(widget.signal)
  const sigHeaderH = showSignalHeader ? 14 : 0
  const availH = h - sigHeaderH

  // Headline value layout — wide ints (≥ 4 digits, no decimals) split last
  // 3 digits onto a smaller font tier so "5200" reads as "5" big + "200"
  // small in a narrow cell. The cap below sizes the run to fit `w` exactly,
  // accounting for outer padding + the unit suffix at FRAC_FONT_SCALE * 0.45.
  const valueStr = String(valueOnly)
  const intLen = valueStr.includes('.') ? valueStr.split('.')[0]!.length : valueStr.length
  const willSplit = !cfg.prefix && intLen > 3 && !valueStr.includes('.')
  const headChars = willSplit ? intLen - 3 : intLen
  const tailChars = willSplit ? 3 : valueStr.includes('.') ? valueStr.length - intLen : 0
  const unitChars = signalUnit.length
  // Effective char budget at the headline font size:
  //   - head chars at full font
  //   - tail (smaller integer trio + any fractional) at FRAC_FONT_SCALE
  //   - unit suffix at ~0.45 (rendered around 0.32 of value but Orbitron
  //     Medium 500 is narrower than Black 900, so the equivalent budget
  //     ends up around 0.45 × FRAC_FONT_SCALE of head font).
  const charBudget =
    headChars + tailChars * FRAC_FONT_SCALE + unitChars * FRAC_FONT_SCALE * 0.45
  // 0.68 = average Orbitron Black 900 advance width in em. 16-px outer
  // padding/gap stays unallocated so the run sits inside the cell with
  // breathing room even after the selection outline expands a few px.
  const fontSize = Math.max(10, Math.min(availH * 0.85, (w - 16) / (charBudget * 0.68)))

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
            textTransform: 'uppercase',
          }}
        >
          {signalLabel.toUpperCase()}
        </span>
      )}
      {/* Widget label overlay — top-left, uppercase. Replaces the auto signal
          header when a custom label is set. */}
      {labelText !== null && (
        <span
          style={{
            position: 'absolute',
            top: 2,
            left: 3,
            fontSize: labelFontSize,
            fontFamily: FONT_FAMILY,
            fontWeight: 500,
            color: '#888888',
            lineHeight: 1,
            whiteSpace: 'nowrap',
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
          }}
        >
          {labelText.toUpperCase()}
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
          // 4+ digit integers (RPM, mileage, oil-temp at high range, …) split
          // last 3 digits onto a smaller font tier so the headline reads as
          // "5.200" — "5" dominant, "200" subordinate — instead of a single
          // run that overflows narrow cells. Mirrors how telemetry HUDs
          // present thousands.
          const isWideInt = !prefix && int.length > 3 && frac === ''
          const intHead = isWideInt ? int.slice(0, -3) : int
          const intTail = isWideInt ? int.slice(-3) : ''
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
                  integer-part size. Fractional part renders at
                  FRAC_FONT_SCALE so AFR / voltage / lambda readouts
                  emphasise the headline number. Wide-int split (5.200)
                  reuses the same small tier for the trailing trio. */}
              <span style={{ fontSize }}>{prefix + intHead}</span>
              {intTail !== '' && (
                <span style={{ fontSize: fontSize * FRAC_FONT_SCALE }}>{intTail}</span>
              )}
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
  'arc' | 'numeric',
  ComponentType<GaugeArcRendererProps | GaugeNumericRendererProps>
> = {
  arc: GaugeArcPreview as ComponentType<GaugeArcRendererProps | GaugeNumericRendererProps>,
  numeric: GaugeNumericPreview as ComponentType<
    GaugeArcRendererProps | GaugeNumericRendererProps
  >,
}

const RENDERERS: RendererDispatch = {
  gauge: (widget, ctx) => {
    if (widget.config.type !== 'gauge') return null
    // Legacy configs with displayStyle='bar' (now removed) fall back to the
    // numeric renderer so old dashboards still mount on a freshly-cleaned
    // Studio. The schema enum already rejects new bar configs.
    const style = widget.config.displayStyle === 'arc' ? 'arc' : 'numeric'
    const Renderer = gaugeRendererByDisplay[style]
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
  // Legacy widget types (bar / warning / timer / image) — renderers were
  // dropped because no shipped config instantiates them. Existing configs
  // that reference these types render as nothing; the picker no longer
  // surfaces them either.
  bar: () => null,
  warning: () => null,
  button: (widget, ctx) => (
    <ButtonPreview widget={widget} w={ctx.w} h={ctx.h} active={ctx.buttonActive} />
  ),
  gear: (widget, ctx) => <GearPreview widget={widget} w={ctx.w} h={ctx.h} />,
  timer: () => null,
  image: () => null,
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
